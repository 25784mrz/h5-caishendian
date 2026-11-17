import assert from "node:assert/strict";
import test from "node:test";
import { CENSER, TEXT } from "../server/constants.js";
import { createHall, join, move, offer } from "../server/hall.js";

const banned = ["博彩"];

function atCenser(hall) {
  move(hall, "session-1", CENSER.x, CENSER.y);
}

test("incense is refused away from the censer and when one is still burning", () => {
  const hall = createHall();
  join(hall, "session-1", "招财", banned, 1000);
  assert.equal(offer(hall, "session-1", "顺风顺水", banned, 1000).message, TEXT.goToCenser);
  atCenser(hall);
  assert.equal(offer(hall, "session-1", "顺风顺水", banned, 1000).ok, true);
  assert.equal(offer(hall, "session-1", "再来一句", banned, 2000).message, TEXT.incenseStill);
});

test("a banned wish does not light incense", () => {
  const hall = createHall();
  join(hall, "session-1", "招财", banned, 1000);
  atCenser(hall);
  assert.equal(offer(hall, "session-1", "博彩发财", banned, 1000).message, TEXT.banned);
  assert.equal(hall.people["session-1"].incense, null);
});
