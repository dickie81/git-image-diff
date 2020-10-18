/* eslint-disable no-console */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const rimraf = require('rimraf');
const glob = require('glob');

const {
  diffImageToSnapshot,
} = require('jest-image-snapshot/src/diff-snapshot');

const snapsDir = 'stories/__tests__/__image_snapshots__/';
const diffDir = './snapshot-diff';
const branchNameFromCli = process.argv[2];
const prIdFromCli = process.argv[3];
const storybookRemotePath = process.argv[4] || '[STORYBOOK_REMOTE]';

const execCommand = (command) =>
  new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      if (stderr) {
        reject(stderr);
        return;
      }

      resolve(
        stdout
          .split('\n')
          .map((filePath) => filePath.trim())
          .filter((filePath) => !!filePath),
      );
    });
  });

const deleteDir = (dir) =>
  new Promise((resolve) => {
    rimraf(dir, resolve);
  });

const globAsync = (pattern) =>
  new Promise((resolve, reject) => {
    glob(pattern, (er, files) => {
      if (er) {
        reject(er);
      }

      resolve(files);
    });
  });

const fileExists = async (filePath) => {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const isDirectoryEmpty = async (dirName) =>
  !(await fs.promises.readdir(dirName)).length;

const removeEmptyDirs = async (globPattern) => {
  const dirs = await globAsync(globPattern);
  for (let i = 0; i < dirs.length; i++) {
    const dir = dirs[i];
    if (await isDirectoryEmpty(dir)) {
      fs.promises.rmdir(dir);
    }
  }
};

execCommand(
  `git --no-pager diff origin/master...@ --name-only | grep ^${snapsDir}`,
)
  .then(async (filePaths) => {
    const branchName =
      branchNameFromCli ||
      (await execCommand('git rev-parse --abbrev-ref HEAD'))[0];
    const originUrl = await execCommand('git config --get remote.origin.url');
    const origin = originUrl[0].split('.git')[0];
    const prLink = prIdFromCli ? `pull/${prIdFromCli}` : `tree/${branchName}`;

    await deleteDir(diffDir);

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      const destPath = `${diffDir}/${filePath.split(snapsDir)[1]}`;
      const destPathParsed = path.parse(destPath);
      const destDir = destPathParsed.dir;
      const destName = destPathParsed.name;
      const snapshotIdentifier = destName.split('-snap')[0];

      await fs.promises.mkdir(path.join(destDir, 'diff'), { recursive: true });
      try {
        await execCommand(`git show origin/master:./${filePath} > ${destPath}`);

        const diffOpts = {
          receivedImageBuffer: fs.readFileSync(filePath),
          snapshotIdentifier,
          snapshotsDir: path.join(__dirname, '..', destDir),
          diffDir: path.join(__dirname, '..', destDir, 'diff'),
          failureThresholdType: 'pixel',
          failureThreshold: 0,
        };

        diffImageToSnapshot(diffOpts);
      } catch {
        // nothing on master - new snapshot, just copy
        const origFilePath = path.join(__dirname, '..', filePath);
        const newFilePath = path.join(
          __dirname,
          '..',
          destDir,
          'diff',
          `${snapshotIdentifier}-new.png`,
        );

        if (await fileExists(origFilePath)) {
          await fs.promises.copyFile(origFilePath, newFilePath);
        }
      }
    }

    // remove original master files
    const masters = await globAsync(`${diffDir}/*/*.png`);
    masters.forEach((file) => {
      fs.unlinkSync(file);
    });

    // move diffs to parent dir
    const diffs = await globAsync(`${diffDir}/*/diff/*.png`);
    diffs.forEach((file) => {
      fs.renameSync(file, file.split('/diff/').join('/'));
    });

    // remove diff dir
    await removeEmptyDirs(`${diffDir}/*/diff`);
    await removeEmptyDirs(`${diffDir}/*`);

    const readMe = [
      `# Image snapshot diff files for [${branchName}](${origin}/${prLink})`,
      '',
    ];
    const newSnaps = [];
    const updatedSnaps = [];

    const dirs = await globAsync(`${diffDir}/*`);

    for (let i = 0; i < dirs.length; i++) {
      const dir = dirs[i];
      const storyId = dir.split('/').pop();
      const isNew = !!(await globAsync(`${dir}/*-new.png`)).length;
      (isNew ? newSnaps : updatedSnaps).push(`- [${storyId}](./${storyId})`);

      fs.writeFileSync(
        `${dir}/README.md`,
        [
          `# ${storyId}`,
          ...(branchNameFromCli
            ? [
                '',
                `[View in storybook](https://raw.githack.com/${storybookRemotePath}/PR-${prIdFromCli}-sb/index.html?path=/story/${storyId})`,
              ]
            : []),
        ].join('\n'),
      );
    }

    if (newSnaps.length) {
      readMe.push('## New snapshots', ...newSnaps, '');
    }

    if (updatedSnaps.length) {
      readMe.push('## Updated snapshots', ...updatedSnaps, '');
    }

    fs.writeFileSync(`${diffDir}/README.md`, readMe.join('\n'));
  })
  .then(() => {
    console.log('!!!done!!!');
  })
  .catch((e) => {
    console.error(e);
    console.log('no diff');
  });
