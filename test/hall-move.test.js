import assert from "node:assert/strict";
import test from "node:test";
import { CENSER, HALL_CAP, TEXT } from "../server/constants.js";
import { createHall, gesture, join, leave, move, occupyCount, offer, restore, snapshot } from "../server/hall.js";

const banned = [];

function fill(hall) {
  for (let i = 0; i < HALL_CAP; i += 1) join(hall, `s${String(i).padStart(8, "0")}`, "招财", banned, 1000);
}

test("a wall stops a person and the door lets them through", () => {
  const hall = createHall();
  join(hall, "session-1", "招财", banned, 1000);
  move(hall, "session-1", 0.2, 0.9);
  const blocked = move(hall, "session-1", 0.2, 0.7);
  assert.equal(blocked.ok, true);
  assert.ok(hall.people["session-1"].y > 0.84);
  move(hall, "session-1", 0.5, 0.9);
  move(hall, "session-1", 0.5, 0.7);
  assert.ok(hall.people["session-1"].y < 0.84);
});

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

test("move rejects non-finite coordinates without changing the person", () => {
  const hall = createHall();
  join(hall, "session-1", "招财", banned, 1000);
  const { x, y } = hall.people["session-1"];
  assert.deepEqual(move(hall, "session-1", Infinity, 0.5), { ok: false, message: TEXT.goOutside });
  assert.equal(hall.people["session-1"].x, x);
  assert.equal(hall.people["session-1"].y, y);
  assert.deepEqual(move(hall, "session-1", NaN, 0.5), { ok: false, message: TEXT.goOutside });
  assert.equal(hall.people["session-1"].x, x);
  assert.equal(hall.people["session-1"].y, y);
});

test("a person can walk into the hall without speaking or lighting incense", () => {
  const hall = createHall();
  join(hall, "session-1", "招财", banned, 1000);
  const moved = move(hall, "session-1", 0.5, 0.3, 1000);
  assert.equal(moved.ok, true);
  assert.equal(moved.message, undefined);
  assert.equal(hall.people["session-1"].y, 0.3);
});

test("a quiet gesture is shared and anything else is refused", () => {
  const hall = createHall();
  join(hall, "session-1", "招财", banned, 1000);
  assert.equal(gesture(hall, "session-1", "bow").ok, true);
  assert.equal(snapshot(hall, "session-1", 1000).people[0].gesture, "bow");
  gesture(hall, "session-1", "");
  assert.equal(snapshot(hall, "session-1", 1000).people[0].gesture, undefined);
  assert.equal(gesture(hall, "session-1", "chat").ok, false);
});

test("someone already in the hall can keep walking after the incense ends", () => {
  const hall = createHall();
  join(hall, "session-1", "招财", banned, 1000);
  hall.people["session-1"].y = 0.4;
  const moved = move(hall, "session-1", 0.5, 0.3, 1000);
  assert.equal(moved.message, undefined);
  assert.equal(hall.people["session-1"].y, 0.3);
});

test("the first step before the god bows once for this incense", () => {
  const hall = createHall();
  join(hall, "session-1", "招财", banned, 1000);
  move(hall, "session-1", CENSER.x, CENSER.y, 1000);
  assert.equal(offer(hall, "session-1", "顺风顺水", banned, 1000).ok, true);
  const moved = move(hall, "session-1", 0.5, 0.32, 1000);
  assert.equal(moved.ok, true);
  assert.equal(hall.people["session-1"].y, 0.32);
  assert.equal(hall.people["session-1"].bowedFor, 1000);
  move(hall, "session-1", 0.55, 0.32, 1000);
  assert.equal(hall.people["session-1"].bowedFor, 1000);
  assert.equal(snapshot(hall, "session-1", 1000).people[0].bowedFor, 1000);
});

test("restore keeps a finite bowedFor and drops a bad one", () => {
  const person = {
    sessionId: "session-1",
    name: "招财",
    x: 0.5,
    y: 0.4,
    place: "inside",
    lastHeartbeat: 0,
    incense: { wish: "顺", litAt: 5 },
  };
  const kept = restore({ people: { "session-1": { ...person, bowedFor: 5 } }, queue: [] }, 10);
  assert.equal(kept.people["session-1"].bowedFor, 5);
  const dropped = restore({ people: { "session-1": { ...person, bowedFor: "no" } }, queue: [] }, 10);
  assert.equal(Object.hasOwn(dropped.people["session-1"], "bowedFor"), false);
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
