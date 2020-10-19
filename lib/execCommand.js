import { exec } from "child_process";

export default (command) =>
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
          .split("\n")
          .map((filePath) => filePath.trim())
          .filter((filePath) => !!filePath)
      );
    });
  });
