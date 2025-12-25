import path from "path";
import { fork } from "child_process";

export const runJobSearch = ({ skill, location, experienceLevel }) => {
  return new Promise((resolve, reject) => {
    const script = path.resolve("./scrap.mjs");
    const child = fork(script, [skill, location, experienceLevel]);

    child.on("message", (msg) => {
      if (msg.status === "success") resolve(msg.data);
      else reject(new Error(msg.error || "Job search failed"));
    });

    child.on("error", reject);

    child.on("exit", (code) => {
      if (code !== 0) reject(new Error("Child process exited with error"));
    });
  });
};
