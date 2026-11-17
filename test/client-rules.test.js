import assert from "node:assert/strict";
import test from "node:test";
import { newlyBowed, newlyLit, pixelToHall, quietName, QUIET_NAMES, readName, readSession, screenFor, shouldShowExit, stepToward, writeName } from "../client/client-rules.js";

function memory() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test("a visitor receives a quiet name and keeps it", () => {
  const phone = memory();
  const first = quietName(phone, () => 0);
  assert.equal(QUIET_NAMES.includes(first), true);
  assert.equal(quietName(phone, () => 0.9), first);
});

test("the name stays on the phone and the session stays on this page", () => {
  const phone = memory();
  const page = memory();
  assert.equal(readName(phone), "");
  writeName(phone, "招财");
  assert.equal(readName(phone), "招财");
  assert.equal(readSession(page, () => "session-1"), "session-1");
  assert.equal(readSession(page, () => "session-2"), "session-1");
});

test("screens and the exit button follow the place", () => {
  assert.equal(screenFor({ name: "", place: null }), "name");
  assert.equal(screenFor({ name: "招财", place: "queue" }), "queue");
  assert.equal(screenFor({ name: "招财", place: "outside" }), "porch");
  assert.equal(screenFor({ name: "招财", place: "inside" }), "hall");
  assert.equal(screenFor({ name: "招财", place: null }), "reopening");
  assert.equal(shouldShowExit("inside"), false);
  assert.equal(shouldShowExit("outside"), true);
  assert.equal(shouldShowExit("queue"), true);
});

test("the bottom strip is outside the door", () => {
  const inside = pixelToHall(50, 200, 100, 400);
  const outside = pixelToHall(50, 360, 100, 400);
  assert.equal(inside.y < 1, true);
  assert.equal(outside.y > 1, true);
});

test("the upper screen is the hall", () => {
  const upper = pixelToHall(50, 80, 100, 400);
  assert.equal(upper.y > 0.35 && upper.y < 0.62, true);
});

test("a person bows when this incense is marked, not when it is lit", () => {
  const before = [{ sessionId: "a", incense: { litAt: 1 }, bowedFor: null }];
  const lit = [{ sessionId: "a", incense: { litAt: 9 } }];
  const bowed = [{ sessionId: "a", incense: { litAt: 9 }, bowedFor: 9 }];
  assert.deepEqual(newlyBowed(before, lit), []);
  assert.deepEqual(newlyBowed(lit, bowed), ["a"]);
  assert.deepEqual(newlyBowed(bowed, bowed), []);
});

test("a person walks toward the click instead of jumping there", () => {
  const next = stepToward({ x: 0.5, y: 0.92 }, { x: 0.5, y: 0.32 }, 0.5);
  assert.equal(next.arrived, false);
  assert.equal(next.x, 0.5);
  assert.equal(next.y < 0.92 && next.y > 0.7, true);
});

test("a long enough step arrives on the clicked spot", () => {
  const next = stepToward({ x: 0.2, y: 0.4 }, { x: 0.8, y: 0.9 }, 10);
  assert.deepEqual(next, { x: 0.8, y: 0.9, arrived: true });
});

test("walking stays on the straight line", () => {
  const next = stepToward({ x: 0, y: 0 }, { x: 0.3, y: 0.4 }, 0.5, 0.5);
  assert.equal(Math.abs(next.x / next.y - 0.75) < 0.001, true);
});

test("a new incense time means that person just bowed", () => {
  const before = [{ sessionId: "a", incense: { litAt: 1 } }];
  const after = [{ sessionId: "a", incense: { litAt: 1 } }, { sessionId: "b", incense: { litAt: 9 } }];
  assert.deepEqual(newlyLit(before, after), ["b"]);
});