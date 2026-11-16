import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";
import { CENSER, HALL_CAP } from "../shared/constants.js";
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
  const dir = await mkdtemp(join(tmpdir(), "temple-"));
  const hallFile = join(dir, "hall.json");
  const wordsFile = join(dir, "words.txt");
  await writeFile(wordsFile, "博彩\n");
  let now = 10_000;
  const server = await createTempleServer({ hallFile, wordsFile, port: 0, now: () => now, sweepInterval: 0 });
  const a = await open(server.port);
  const b = await open(server.port);
  a.send({ type: "hello", name: "招财", sessionId: "session-a" });
  b.send({ type: "hello", name: "进宝", sessionId: "session-b" });
  await a.next();
  await b.next();
  a.send({ type: "offer", wish: "博彩" });
  assert.equal((await a.next()).message, "这句话不能用");
  a.send({ type: "move", x: CENSER.x, y: CENSER.y });
  await a.next();
  a.send({ type: "offer", wish: "顺风顺水" });
  const seen = await b.next();
  assert.equal(seen.people.find((person) => person.sessionId === "session-a").incense.wish, "顺风顺水");
  await server.close();
  await rm(dir, { recursive: true });
});

test("the forty-first person enters when someone exits", async () => {
  const dir = await mkdtemp(join(tmpdir(), "temple-"));
  const wordsFile = join(dir, "words.txt");
  await writeFile(wordsFile, "\n");
  const server = await createTempleServer({
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
  await server.close();
  await rm(dir, { recursive: true });
});

test("a broken hall file stops startup and stays on disk", async () => {
  const dir = await mkdtemp(join(tmpdir(), "temple-"));
  const hallFile = join(dir, "hall.json");
  const wordsFile = join(dir, "words.txt");
  await writeFile(hallFile, "{");
  await writeFile(wordsFile, "\n");
  await assert.rejects(createTempleServer({ hallFile, wordsFile, port: 0, sweepInterval: 0 }));
  assert.equal(await readFile(hallFile, "utf8"), "{");
  await rm(dir, { recursive: true });
});
