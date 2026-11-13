import assert from "node:assert/strict";
import test from "node:test";
import { CENSER, HALL_CAP, HEARTBEAT_TIMEOUT_MS, INCENSE_MS } from "../shared/constants.js";
import { createHall, heartbeat, join, move, offer, restore, sweep } from "../server/hall.js";

const banned = [];

test("one minute without a heartbeat removes the person and frees the slot", () => {
  const hall = createHall();
  for (let i = 0; i < HALL_CAP; i += 1) join(hall, `s${String(i).padStart(8, "0")}`, "招财", banned, 0);
  for (let i = 1; i < HALL_CAP; i += 1) heartbeat(hall, `s${String(i).padStart(8, "0")}`, HEARTBEAT_TIMEOUT_MS);
  join(hall, "session-a", "进宝", banned, HEARTBEAT_TIMEOUT_MS);
  sweep(hall, HEARTBEAT_TIMEOUT_MS + 1);
  assert.equal(hall.people["s00000000"], undefined);
  assert.equal(hall.people["s00000001"].place, "inside");
  assert.equal(hall.people["session-a"].place, "inside");
});

test("incense disappears at three minutes and can be lit again", () => {
  const hall = createHall();
  join(hall, "session-1", "招财", banned, 0);
  move(hall, "session-1", CENSER.x, CENSER.y);
  offer(hall, "session-1", "顺风顺水", banned, 0);
  heartbeat(hall, "session-1", INCENSE_MS);
  sweep(hall, INCENSE_MS);
  assert.equal(hall.people["session-1"].incense, null);
  assert.equal(offer(hall, "session-1", "再顺一次", banned, INCENSE_MS).ok, true);
});

test("restore keeps a fresh person and drops an expired heartbeat", () => {
  const saved = createHall();
  join(saved, "session-1", "招财", banned, 0);
  join(saved, "session-2", "进宝", banned, 5000);
  const hall = restore(saved, HEARTBEAT_TIMEOUT_MS + 1);
  assert.equal(hall.people["session-1"], undefined);
  assert.equal(hall.people["session-2"].name, "进宝");
});

test("restore rejects a broken shape", () => {
  assert.throws(() => restore({ people: [] }, 0), /hall file unreadable/);
});
