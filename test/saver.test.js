import assert from "node:assert/strict";
import test from "node:test";
import { createSaver } from "../server/saver.js";

test("heartbeats inside one second write once", async () => {
  const writes = [];
  const saver = createSaver(async (hall) => writes.push(hall.n));
  await saver.saveHeartbeat({ n: 1 }, 1000);
  await saver.saveHeartbeat({ n: 2 }, 1500);
  await saver.flush(1500);
  assert.deepEqual(writes, [1]);
  await saver.flush(2000);
  assert.deepEqual(writes, [1, 2]);
});

test("saveNow writes immediately", async () => {
  const writes = [];
  const saver = createSaver(async (hall) => writes.push(hall.n));
  await saver.saveNow({ n: 7 });
  assert.deepEqual(writes, [7]);
});
