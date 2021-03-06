/* eslint-disable no-console */
import doDiff from "./lib/doDiff";

(async () => {
  try {
    await doDiff({
      snapsDir: "stories/__tests__/__image_snapshots__/",
      diffDir: "./snapshot-diff",
      branchNameFromCli: process.argv[2],
      prIdFromCli: process.argv[3],
      storybookRemotePath: process.argv[4] || "[STORYBOOK_REMOTE]"
    });
    console.log("!!!done!!!");
  } catch (e) {
    console.error(e);
    console.log("no diff");
  }
})();
