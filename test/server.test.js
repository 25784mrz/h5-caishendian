import assert from "node:assert/strict";
import test from "node:test";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";
import { CENSER, HALL_CAP } from "../server/constants.js";
import { createTempleServer } from "../server/server.js";

async function open(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((resolve) => ws.once("open", resolve));
  const messages = [];
  ws.on("message", (buf) => messages.push(JSON.parse(String(buf))));
  return {
    ws,
    send(msg) { ws.send(JSON.stringify(msg)); },
    async next() {
      const start = messages.length;
      for (let i = 0; i < 20; i += 1) {
        if (messages.length > start) return messages[messages.length - 1];
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      throw new Error("no message");
    },
  };
}

test("two browsers see one wish, and the server rejects a bad wish", async () => {
  let dir;
  let server;
  try {
    dir = await mkdtemp(join(tmpdir(), "temple-"));
    const hallFile = join(dir, "hall.json");
    const wordsFile = join(dir, "words.txt");
    await writeFile(wordsFile, "博彩\n");
    let now = 10_000;
    server = await createTempleServer({ hallFile, wordsFile, port: 0, now: () => now, sweepInterval: 0 });
    const a = await open(server.port);
    const b = await open(server.port);
    a.send({ type: "hello", name: "招财", sessionId: "session-a" });
    await a.next();
    b.send({ type: "hello", name: "进宝", sessionId: "session-b" });
    await b.next();
    a.send({ type: "offer", wish: "博彩" });
    assert.equal((await a.next()).message, "先走到香炉前");
    a.send({ type: "move", x: CENSER.x, y: CENSER.y });
    await a.next();
    a.send({ type: "offer", wish: "博彩" });
    assert.equal((await a.next()).message, "这句话不能用");
    a.send({ type: "offer", wish: "顺风顺水" });
    const seen = await b.next();
    assert.equal(seen.people.find((person) => person.sessionId === "session-a").incense.wish, "顺风顺水");
  } finally {
    if (server) await server.close();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

test("the forty-first person enters when someone exits", async () => {
  let dir;
  let server;
  try {
    dir = await mkdtemp(join(tmpdir(), "temple-"));
    const wordsFile = join(dir, "words.txt");
    await writeFile(wordsFile, "\n");
    server = await createTempleServer({
      hallFile: join(dir, "hall.json"),
      wordsFile,
      port: 0,
      now: () => 10_000,
      sweepInterval: 0,
    });
    const clients = [];
    for (let i = 0; i < HALL_CAP; i += 1) {
      const client = await open(server.port);
      client.send({ type: "hello", name: "招财", sessionId: `session-${String(i).padStart(2, "0")}` });
      await client.next();
      clients.push(client);
    }
    const waiting = await open(server.port);
    waiting.send({ type: "hello", name: "进宝", sessionId: "session-waiting" });
    assert.equal((await waiting.next()).place, "queue");
    clients[0].send({ type: "move", x: 0.5, y: 1.1 });
    await clients[0].next();
    clients[0].send({ type: "exit" });
    const entered = await waiting.next();
    assert.equal(entered.place, "inside");
  } finally {
    if (server) await server.close();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

test("a broken hall file stops startup and stays on disk", async () => {
  let dir;
  try {
    dir = await mkdtemp(join(tmpdir(), "temple-"));
    const hallFile = join(dir, "hall.json");
    const wordsFile = join(dir, "words.txt");
    await writeFile(hallFile, "{");
    await writeFile(wordsFile, "\n");
    await assert.rejects(createTempleServer({ hallFile, wordsFile, port: 0, sweepInterval: 0 }));
    assert.equal(await readFile(hallFile, "utf8"), "{");
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

test("a socket ignores a second hello with a different session id", async () => {
  let dir;
  let server;
  try {
    dir = await mkdtemp(join(tmpdir(), "temple-"));
    const wordsFile = join(dir, "words.txt");
    await writeFile(wordsFile, "\n");
    server = await createTempleServer({
      hallFile: join(dir, "hall.json"),
      wordsFile,
      port: 0,
      now: () => 10_000,
      sweepInterval: 0,
    });
    const client = await open(server.port);
    client.send({ type: "hello", name: "招财", sessionId: "session-first" });
    await client.next();
    client.send({ type: "hello", name: "进宝", sessionId: "session-second" });
    client.send({ type: "move", x: 0.5, y: 0.5 });
    await client.next();
    assert.deepEqual(Object.keys(server.hall.people), ["session-first"]);
  } finally {
    if (server) await server.close();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

test("a failed save is not broadcast and the next change persists both", async () => {
  let dir;
  let server;
  const originalError = console.error;
  const errors = [];
  try {
    dir = await mkdtemp(join(tmpdir(), "temple-"));
    const hallFile = join(dir, "hall.json");
    const wordsFile = join(dir, "words.txt");
    await writeFile(wordsFile, "\n");
    server = await createTempleServer({
      hallFile,
      wordsFile,
      port: 0,
      now: () => 10_000,
      sweepInterval: 0,
    });
    const client = await open(server.port);
    client.send({ type: "hello", name: "招财", sessionId: "session-durable" });
    await client.next();

    console.error = (error) => errors.push(error);
    await chmod(dir, 0o500);
    client.send({ type: "move", x: CENSER.x, y: CENSER.y });
    await assert.rejects(client.next(), /no message/);
    assert.equal(errors.length, 1);

    await chmod(dir, 0o700);
    client.send({ type: "offer", wish: "顺风顺水" });
    const state = await client.next();
    assert.equal(state.people[0].incense.wish, "顺风顺水");

    const saved = JSON.parse(await readFile(hallFile, "utf8"));
    assert.equal(saved.people["session-durable"].x, CENSER.x);
    assert.equal(saved.people["session-durable"].y, CENSER.y);
    assert.equal(saved.people["session-durable"].incense.wish, "顺风顺水");
  } finally {
    console.error = originalError;
    if (dir) await chmod(dir, 0o700).catch(() => {});
    if (server) await server.close();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});
