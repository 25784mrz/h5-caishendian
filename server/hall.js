import { ENTRY, HALL_CAP } from "../shared/constants.js";
import { checkText } from "./filter.js";

export function createHall() {
  return { people: {}, queue: [] };
}

export function occupyCount(hall) {
  return Object.values(hall.people).filter((person) => person.place === "inside" || person.place === "outside").length;
}

export function join(hall, sessionId, name, bannedWords, now) {
  if (typeof sessionId !== "string" || sessionId.length < 8) {
    return { ok: false, message: "这句话不能用" };
  }
  const existing = hall.people[sessionId];
  if (existing) {
    existing.lastHeartbeat = now;
    return { ok: true, result: "resumed" };
  }
  const checked = checkText(name, "name", bannedWords);
  if (!checked.ok) return checked;
  const person = {
    sessionId,
    name,
    x: null,
    y: null,
    place: "queue",
    lastHeartbeat: now,
    incense: null,
  };
  hall.people[sessionId] = person;
  if (occupyCount(hall) < HALL_CAP) {
    person.place = "inside";
    person.x = ENTRY.x;
    person.y = ENTRY.y;
    return { ok: true, result: "entered" };
  }
  hall.queue.push(sessionId);
  return { ok: true, result: "queued" };
}

export function snapshot(hall, sessionId) {
  const you = hall.people[sessionId];
  return {
    now: you?.lastHeartbeat ?? 0,
    you: sessionId,
    place: you?.place ?? null,
    queueAhead: you?.place === "queue" ? Math.max(0, hall.queue.indexOf(sessionId)) : 0,
    people: Object.values(hall.people).map((person) => ({
      sessionId: person.sessionId,
      name: person.name,
      x: person.x,
      y: person.y,
      place: person.place,
      incense: person.incense ? { wish: person.incense.wish, litAt: person.incense.litAt } : null,
    })),
  };
}
