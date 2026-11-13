import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHall, join as enter } from "../server/hall.js";
import { readHallFile, writeHallFile } from "../server/store.js";

test("a missing file stays missing and reads as an empty hall", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hall-"));
  const file = join(dir, "hall.json");
  const hall = await readHallFile(file, 0);
  assert.deepEqual(hall, createHall());
  await assert.rejects(stat(file));
  await rm(dir, { recursive: true });
});

test("a saved person is still there after reading", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hall-"));
  const file = join(dir, "hall.json");
  const hall = createHall();
  enter(hall, "session-1", "招财", [], 1000);
  await writeHallFile(file, hall);
  const loaded = await readHallFile(file, 1000);
  assert.equal(loaded.people["session-1"].name, "招财");
  await rm(dir, { recursive: true });
});

test("a broken file is left untouched", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hall-"));
  const file = join(dir, "hall.json");
  await writeFile(file, "{");
  await assert.rejects(readHallFile(file, 0), /hall file unreadable/);
  assert.equal(await readFile(file, "utf8"), "{");
  await rm(dir, { recursive: true });
});

test("concurrent writes leave one complete hall on disk", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hall-"));
  const file = join(dir, "hall.json");
  const hallA = createHall();
  const hallB = createHall();
  enter(hallA, "session-aaaaa", "甲", [], 1000);
  enter(hallB, "session-bbbbb", "乙", [], 1000);
  await Promise.all([writeHallFile(file, hallA), writeHallFile(file, hallB)]);
  const parsed = JSON.parse(await readFile(file, "utf8"));
  let matches = false;
  try {
    assert.deepEqual(parsed, hallA);
    matches = true;
  } catch {
    try {
      assert.deepEqual(parsed, hallB);
      matches = true;
    } catch {
      matches = false;
    }
  }
  assert.ok(matches);
  await rm(dir, { recursive: true });
});
