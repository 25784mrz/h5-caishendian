import assert from "node:assert/strict";
import test from "node:test";
import { HALL_CAP, TEXT } from "../shared/constants.js";
import { createHall, join, leave, move, occupyCount } from "../server/hall.js";

const banned = [];

function fill(hall) {
  for (let i = 0; i < HALL_CAP; i += 1) join(hall, `s${String(i).padStart(8, "0")}`, "招财", banned, 1000);
}

test("walking past the door is outside, walking back is inside", () => {
  const hall = createHall();
  join(hall, "session-1", "招财", banned, 1000);
  move(hall, "session-1", 0.5, 1.1);
  assert.equal(hall.people["session-1"].place, "outside");
  move(hall, "session-1", 0.4, 0.5);
  assert.equal(hall.people["session-1"].place, "inside");
  assert.equal(hall.people["session-1"].x, 0.4);
});

test("leave works outside and in the queue, and refuses inside", () => {
  const hall = createHall();
  join(hall, "session-1", "招财", banned, 1000);
  assert.equal(leave(hall, "session-1").message, TEXT.goOutside);
  move(hall, "session-1", 0.5, 1.1);
  assert.equal(leave(hall, "session-1").ok, true);
  assert.equal(hall.people["session-1"], undefined);
});

test("an outside person still uses a slot until they exit", () => {
  const hall = createHall();
  fill(hall);
  move(hall, "s00000000", 0.5, 1.1);
  const waiting = join(hall, "session-9", "进宝", banned, 1000);
  assert.equal(waiting.result, "queued");
  assert.equal(occupyCount(hall), HALL_CAP);
  leave(hall, "s00000000");
  assert.equal(hall.people["session-9"].place, "inside");
  assert.equal(hall.people["session-9"].y < 1, true);
});

test("leaving the queue does not let a later person skip ahead", () => {
  const hall = createHall();
  fill(hall);
  join(hall, "session-a", "进宝", banned, 1000);
  join(hall, "session-b", "纳福", banned, 1000);
  leave(hall, "session-a");
  assert.equal(hall.people["session-b"].place, "queue");
  assert.deepEqual(hall.queue, ["session-b"]);
});
