import assert from "node:assert/strict";
import test from "node:test";
import { newlyLit, pixelToHall, readName, readSession, screenFor, shouldShowExit, writeName } from "../public/client-rules.js";

function memory() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

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

test("a new incense time means that person just bowed", () => {
  const before = [{ sessionId: "a", incense: { litAt: 1 } }];
  const after = [{ sessionId: "a", incense: { litAt: 1 } }, { sessionId: "b", incense: { litAt: 9 } }];
  assert.deepEqual(newlyLit(before, after), ["b"]);
});