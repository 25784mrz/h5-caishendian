import {
  DOOR_Y,
  ENTRY,
  HALL_CAP,
  HEARTBEAT_TIMEOUT_MS,
  INCENSE_MS,
  MOVE_X,
  MOVE_Y,
  TEXT,
  nearCenser,
} from "../shared/constants.js";
import { checkText } from "./filter.js";

export function createHall() {
  return { people: {}, queue: [] };
}

export function occupyCount(hall) {
  return Object.values(hall.people).filter((person) => person.place === "inside" || person.place === "outside").length;
}

export function join(hall, sessionId, name, bannedWords, now) {
  if (typeof sessionId !== "string" || !/^s[a-z0-9-]{7,}$/.test(sessionId)) {
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

export function promote(hall) {
  while (occupyCount(hall) < HALL_CAP && hall.queue.length > 0) {
    const sessionId = hall.queue.shift();
    const person = hall.people[sessionId];
    if (!person) continue;
    person.place = "inside";
    person.x = ENTRY.x;
    person.y = ENTRY.y;
  }
}

export function move(hall, sessionId, x, y) {
  const person = hall.people[sessionId];
  if (!person || person.place === "queue") return { ok: false, message: TEXT.goOutside };
  const nx = Number(x);
  const ny = Number(y);
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return { ok: false, message: TEXT.goOutside };
  const cx = Math.min(MOVE_X.max, Math.max(MOVE_X.min, nx));
  const cy = Math.min(MOVE_Y.max, Math.max(MOVE_Y.min, ny));
  person.x = cx;
  person.y = cy;
  person.place = cy > DOOR_Y ? "outside" : "inside";
  return { ok: true };
}

export function offer(hall, sessionId, wish, bannedWords, now) {
  const person = hall.people[sessionId];
  if (!person || person.place !== "inside" || !nearCenser(person.x, person.y)) {
    return { ok: false, message: TEXT.goToCenser };
  }
  if (person.incense && now - person.incense.litAt < INCENSE_MS) {
    return { ok: false, message: TEXT.incenseStill };
  }
  const checked = checkText(wish, "wish", bannedWords);
  if (!checked.ok) return checked;
  person.incense = { wish, litAt: now };
  return { ok: true };
}

export function leave(hall, sessionId) {
  const person = hall.people[sessionId];
  if (!person || person.place === "inside") return { ok: false, message: TEXT.goOutside };
  delete hall.people[sessionId];
  hall.queue = hall.queue.filter((id) => id !== sessionId);
  promote(hall);
  return { ok: true };
}

export function snapshot(hall, sessionId, now = 0) {
  const you = hall.people[sessionId];
  return {
    now,
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

export function heartbeat(hall, sessionId, now) {
  const person = hall.people[sessionId];
  if (!person) return { ok: false };
  person.lastHeartbeat = now;
  return { ok: true };
}

export function sweep(hall, now) {
  for (const person of Object.values(hall.people)) {
    if (now - person.lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
      delete hall.people[person.sessionId];
      continue;
    }
    if (person.incense && now - person.incense.litAt >= INCENSE_MS) person.incense = null;
  }
  hall.queue = hall.queue.filter((id) => hall.people[id]);
  promote(hall);
  return hall;
}

export function restore(data, now) {
  if (
    !data ||
    data.people === null ||
    typeof data.people !== "object" ||
    Array.isArray(data.people) ||
    !Array.isArray(data.queue)
  ) {
    throw new Error("hall file unreadable");
  }
  const hall = createHall();
  for (const [id, person] of Object.entries(data.people)) {
    if (!person || person.sessionId !== id || typeof person.name !== "string") {
      throw new Error("hall file unreadable");
    }
    if (!Number.isFinite(person.lastHeartbeat)) {
      throw new Error("hall file unreadable");
    }
    if (person.place !== "inside" && person.place !== "outside" && person.place !== "queue") {
      throw new Error("hall file unreadable");
    }
    if (person.place === "inside" || person.place === "outside") {
      if (!Number.isFinite(person.x) || !Number.isFinite(person.y)) {
        throw new Error("hall file unreadable");
      }
    } else if (person.x !== null || person.y !== null) {
      throw new Error("hall file unreadable");
    }
    if (person.incense !== null) {
      if (
        typeof person.incense !== "object" ||
        typeof person.incense.wish !== "string" ||
        !Number.isFinite(person.incense.litAt)
      ) {
        throw new Error("hall file unreadable");
      }
    }
    hall.people[id] = {
      sessionId: id,
      name: person.name,
      x: person.x ?? null,
      y: person.y ?? null,
      place: person.place,
      lastHeartbeat: person.lastHeartbeat,
      incense: person.incense ? { wish: person.incense.wish, litAt: person.incense.litAt } : null,
    };
  }
  hall.queue = data.queue.slice();
  return sweep(hall, now);
}
