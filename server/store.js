import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createHall, restore } from "./hall.js";

export async function readHallFile(file, now) {
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return createHall();
    throw error;
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("hall file unreadable");
  }
  return restore(data, now);
}

export async function writeHallFile(file, hall) {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(hall));
  await rename(tmp, file);
}
