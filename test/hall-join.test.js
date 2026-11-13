import assert from "node:assert/strict";
import test from "node:test";
import { HALL_CAP } from "../shared/constants.js";
import { createHall, join, occupyCount, snapshot } from "../server/hall.js";

const banned = ["傻逼"];

test("the first person enters at the door", () => {
  const hall = createHall();
  const result = join(hall, "session-1", "招财", banned, 1000);
  assert.equal(result.result, "entered");
  assert.equal(occupyCount(hall), 1);
  assert.equal(hall.people["session-1"].place, "inside");
  assert.equal(hall.people["session-1"].y < 1, true);
});

test("person 41 waits, and the queue order is arrival order", () => {
  const hall = createHall();
  for (let i = 0; i < HALL_CAP; i += 1) join(hall, `session-s${i}`, "招财", banned, 1000);
  const waiting = join(hall, "session-s40", "进宝", banned, 1000);
  const later = join(hall, "session-s41", "纳福", banned, 1000);
  assert.equal(waiting.result, "queued");
  assert.equal(later.result, "queued");
  assert.deepEqual(hall.queue, ["session-s40", "session-s41"]);
  assert.equal(snapshot(hall, "session-s41").queueAhead, 1);
  assert.equal(occupyCount(hall), HALL_CAP);
});

test("the same session resumes in place and does not rename", () => {
  const hall = createHall();
  join(hall, "session-1", "招财", banned, 1000);
  hall.people["session-1"].x = 0.2;
  const again = join(hall, "session-1", "改名", banned, 2000);
  assert.equal(again.result, "resumed");
  assert.equal(hall.people["session-1"].name, "招财");
  assert.equal(hall.people["session-1"].x, 0.2);
  assert.equal(hall.people["session-1"].lastHeartbeat, 2000);
});

test("a bad name does not enter", () => {
  const hall = createHall();
  const result = join(hall, "session-1", "ab", banned, 1000);
  assert.equal(result.ok, false);
  assert.equal(occupyCount(hall), 0);
});

test("object prototype names are not accepted as session ids", () => {
  const hall = createHall();
  const proto = join(hall, "__proto__", "招财", banned, 1000);
  const ctor = join(hall, "constructor", "进宝", banned, 1000);
  assert.equal(proto.ok, false);
  assert.equal(proto.message, "这句话不能用");
  assert.equal(ctor.ok, false);
  assert.equal(ctor.message, "这句话不能用");
  assert.equal(occupyCount(hall), 0);
  assert.equal(Object.hasOwn(hall.people, "__proto__"), false);
  assert.equal(Object.hasOwn(hall.people, "constructor"), false);
});
