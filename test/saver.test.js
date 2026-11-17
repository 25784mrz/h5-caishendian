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

test("a failed write stays pending for a later flush", async () => {
  const writes = [];
  let fail = true;
  const hall = { n: 9 };
  const saver = createSaver(async (value) => {
    if (fail) {
      fail = false;
      throw new Error("disk unavailable");
    }
    writes.push(value.n);
  });

  await assert.rejects(saver.saveNow(hall, 1000), /disk unavailable/);
  await saver.flush(1000);
  assert.deepEqual(writes, [9]);
});
