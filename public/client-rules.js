import { DOOR_Y, MOVE_X, MOVE_Y } from "../shared/constants.js";

export const NAME_KEY = "caishen-name";
export const SESSION_KEY = "caishen-session";

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
  let y;
  if (ratio <= 0.18) y = MOVE_Y.min;
  else if (ratio >= 0.78) y = DOOR_Y + ((ratio - 0.78) / 0.22) * (MOVE_Y.max - DOOR_Y);
  else y = MOVE_Y.min + ((ratio - 0.18) / 0.6) * (DOOR_Y - MOVE_Y.min);
  return { x, y: Math.min(MOVE_Y.max, Math.max(MOVE_Y.min, y)) };
}

export function newlyLit(previousPeople, nextPeople) {
  const previous = new Map((previousPeople ?? []).map((person) => [person.sessionId, person.incense?.litAt ?? null]));
  return (nextPeople ?? [])
    .filter((person) => person.incense && person.incense.litAt !== previous.get(person.sessionId))
    .map((person) => person.sessionId);
}