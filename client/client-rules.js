import { DOOR_Y, HALL_DOOR_Y, MOVE_X, MOVE_Y } from "./constants.js";

export const NAME_KEY = "caishen-name";
export const SESSION_KEY = "caishen-session";

export const QUIET_NAMES = ["慢云", "淡月", "静风", "软苔", "迟步", "薄雾", "安石", "暖灯", "空庭", "细雨"];

export function quietName(storage, random = Math.random) {
  const existing = readName(storage);
  if (existing) return existing;
  const picked = QUIET_NAMES[Math.floor(random() * QUIET_NAMES.length)] ?? QUIET_NAMES[0];
  writeName(storage, picked);
  return picked;
}

export function readName(storage) {
  return storage.getItem(NAME_KEY) ?? "";
}

export function writeName(storage, name) {
  storage.setItem(NAME_KEY, name);
}

export function readSession(storage, randomUUID) {
  const existing = storage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = randomUUID();
  storage.setItem(SESSION_KEY, created);
  return created;
}

export function screenFor({ name, place }) {
  if (!name) return "name";
  if (place === "queue") return "queue";
  if (place === "outside") return "porch";
  if (place === "inside") return "hall";
  return "reopening";
}

export function shouldShowExit(place) {
  return place === "outside" || place === "queue";
}

export function pixelToHall(px, py, width, height) {
  const x = Math.min(MOVE_X.max, Math.max(MOVE_X.min, px / width));
  const ratio = py / height;
  const hallBand = 0.45;
  const courtBand = 0.78;
  let y;
  if (ratio >= courtBand) y = DOOR_Y + ((ratio - courtBand) / (1 - courtBand)) * (MOVE_Y.max - DOOR_Y);
  else if (ratio <= hallBand) y = MOVE_Y.min + (ratio / hallBand) * (HALL_DOOR_Y - MOVE_Y.min);
  else y = HALL_DOOR_Y + ((ratio - hallBand) / (courtBand - hallBand)) * (DOOR_Y - HALL_DOOR_Y);
  return { x, y: Math.min(MOVE_Y.max, Math.max(MOVE_Y.min, y)) };
}

export const WALK_SPEED = 0.3;

export function stepToward(from, to, seconds, speed = WALK_SPEED) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || seconds * speed >= distance) return { x: to.x, y: to.y, arrived: true };
  const scale = (seconds * speed) / distance;
  return { x: from.x + dx * scale, y: from.y + dy * scale, arrived: false };
}

export function newlyBowed(previousPeople, nextPeople) {
  const previous = new Map((previousPeople ?? []).map((person) => [person.sessionId, person.bowedFor ?? null]));
  return (nextPeople ?? [])
    .filter((person) => person.incense && person.bowedFor === person.incense.litAt && previous.get(person.sessionId) !== person.bowedFor)
    .map((person) => person.sessionId);
}

export function newlyLit(previousPeople, nextPeople) {
  const previous = new Map((previousPeople ?? []).map((person) => [person.sessionId, person.incense?.litAt ?? null]));
  return (nextPeople ?? [])
    .filter((person) => person.incense && person.incense.litAt !== previous.get(person.sessionId))
    .map((person) => person.sessionId);
}