import fs from "fs";
import { diffImageToSnapshot } from "jest-image-snapshot/src/diff-snapshot.js";
import path from "path";

import execCommand from "./execCommand.js";
import {
  deleteDir,
  fileExists,
  globAsync,
  removeEmptyDirs
} from "./fileHelpers.js";

export default async ({
  snapsDir,
  diffDir,
  branchNameFromCli,
  prIdFromCli,
  storybookRemotePath
}) => {
  const filePaths = execCommand(
    `git --no-pager diff origin/master...@ --name-only | grep ^${snapsDir}`
  );

  const branchName =
    branchNameFromCli ||
    (await execCommand("git rev-parse --abbrev-ref HEAD"))[0];
  const originUrl = await execCommand("git config --get remote.origin.url");
  const origin = originUrl[0].split(".git")[0];
  const prLink = prIdFromCli ? `pull/${prIdFromCli}` : `tree/${branchName}`;

  await deleteDir(diffDir);

  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    const destPath = `${diffDir}/${filePath.split(snapsDir)[1]}`;
    const destPathParsed = path.parse(destPath);
    const destDir = destPathParsed.dir;
    const destName = destPathParsed.name;
    const snapshotIdentifier = destName.split("-snap")[0];

    await fs.promises.mkdir(path.join(destDir, "diff"), { recursive: true });
    try {
      await execCommand(`git show origin/master:./${filePath} > ${destPath}`);

      const diffOpts = {
        receivedImageBuffer: fs.readFileSync(filePath),
        snapshotIdentifier,
        snapshotsDir: path.join(__dirname, "..", destDir),
        diffDir: path.join(__dirname, "..", destDir, "diff"),
        failureThresholdType: "pixel",
        failureThreshold: 0
      };

      diffImageToSnapshot(diffOpts);
    } catch {
      // nothing on master - new snapshot, just copy
      const origFilePath = path.join(__dirname, "..", filePath);
      const newFilePath = path.join(
        __dirname,
        "..",
        destDir,
        "diff",
        `${snapshotIdentifier}-new.png`
      );

      if (await fileExists(origFilePath)) {
        await fs.promises.copyFile(origFilePath, newFilePath);
      }
    }
  }

  // remove original master files
  const masters = await globAsync(`${diffDir}/*/*.png`);
  await Promise.all(
    masters.map(async (file) => {
      fs.promises.unlink(file);
    })
  );

  // move diffs to parent dir
  const diffs = await globAsync(`${diffDir}/*/diff/*.png`);
  await Promise.all(
    diffs.map(async (file) => {
      fs.promises.rename(file, file.split("/diff/").join("/"));
    })
  );

  // remove diff dir
  await removeEmptyDirs(`${diffDir}/*/diff`);
  await removeEmptyDirs(`${diffDir}/*`);

  const readMe = [
    `# Image snapshot diff files for [${branchName}](${origin}/${prLink})`,
    ""
  ];
  const newSnaps = [];
  const updatedSnaps = [];

  const dirs = await globAsync(`${diffDir}/*`);

  for (let i = 0; i < dirs.length; i++) {
    const dir = dirs[i];
    const storyId = dir.split("/").pop();
    const isNew = !!(await globAsync(`${dir}/*-new.png`)).length;
    (isNew ? newSnaps : updatedSnaps).push(`- [${storyId}](./${storyId})`);

    await fs.promises.writeFile(
      `${dir}/README.md`,
      [
        `# ${storyId}`,
        ...(branchNameFromCli
          ? [
              "",
              `[View in storybook](https://raw.githack.com/${storybookRemotePath}/PR-${prIdFromCli}-sb/index.html?path=/story/${storyId})`
            ]
          : [])
      ].join("\n")
    );
  }

  if (newSnaps.length) {
    readMe.push("## New snapshots", ...newSnaps, "");
  }

  if (updatedSnaps.length) {
    readMe.push("## Updated snapshots", ...updatedSnaps, "");
  }

  await fs.promises.writeFile(`${diffDir}/README.md`, readMe.join("\n"));
};
