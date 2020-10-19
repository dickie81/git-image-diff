import fs from "fs";
import glob from "glob";
import rimraf from "rimraf";

export const deleteDir = (dir) =>
  new Promise((resolve) => {
    rimraf(dir, resolve);
  });

export const globAsync = (pattern) =>
  new Promise((resolve, reject) => {
    glob(pattern, (er, files) => {
      if (er) {
        reject(er);
      }

      resolve(files);
    });
  });

export const fileExists = async (filePath) => {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

export const isDirectoryEmpty = async (dirName) =>
  !(await fs.promises.readdir(dirName)).length;

export const removeEmptyDirs = async (globPattern) => {
  const dirs = await globAsync(globPattern);
  Promise.all(
    dirs.map(async (dir) => {
      if (await isDirectoryEmpty(dir)) {
        await fs.promises.rmdir(dir);
      }
    })
  );
};
