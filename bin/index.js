#!/usr/bin/env node
/* eslint-disable no-console */
import doDiff from "../lib/doDiff.js";

(async () => {
  try {
    await doDiff({
      masterBranch: "master",
      snapsDir: "test/fixtures/",
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
