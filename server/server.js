import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { heartbeat, join as enter, leave, move, offer, snapshot, sweep } from "./hall.js";
import { createSaver } from "./saver.js";
import { readHallFile, writeHallFile } from "./store.js";
import { loadBannedWords } from "./words.js";
import { checkText } from "./filter.js";
import { SWEEP_MS } from "../shared/constants.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  "/": ["public/index.html", "text/html; charset=utf-8"],
  "/index.html": ["public/index.html", "text/html; charset=utf-8"],
  "/hall.js": ["public/hall.js", "text/javascript; charset=utf-8"],
  "/hall.css": ["public/hall.css", "text/css; charset=utf-8"],
  "/client-rules.js": ["public/client-rules.js", "text/javascript; charset=utf-8"],
  "/ambient.js": ["public/ambient.js", "text/javascript; charset=utf-8"],
  "/shared/constants.js": ["shared/constants.js", "text/javascript; charset=utf-8"],
  "/server/filter.js": ["server/filter.js", "text/javascript; charset=utf-8"],
  "/data/words.txt": ["data/words.txt", "text/plain; charset=utf-8"],
};

async function serveStatic(req, res) {
  const url = new URL(req.url, "http://127.0.0.1");
  const match = files[url.pathname];
  if (!match) {
    res.writeHead(404);
    res.end();
    return;
  }
  const body = await readFile(join(root, match[0]));
  res.writeHead(200, { "content-type": match[1] });
  res.end(body);
}

export async function createTempleServer(options) {
  const nowFn = options.now ?? (() => Date.now());
  const hall = await readHallFile(options.hallFile, nowFn());
  const bannedWords = loadBannedWords(await readFile(options.wordsFile, "utf8"));
  const saver = createSaver((value) => writeHallFile(options.hallFile, value));
  const sockets = new Map();
  let helloChain = Promise.resolve();

  function broadcast() {
    const now = nowFn();
    for (const [sessionId, ws] of sockets) {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: "state", ...snapshot(hall, sessionId, now) }));
    }
  }

  const httpServer = createServer((req, res) => {
    serveStatic(req, res).catch(() => {
      res.writeHead(500);
      res.end();
    });
  });
  const wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", (ws) => {
    let sessionId = null;
    ws.on("message", async (buf) => {
      let msg;
      try {
        msg = JSON.parse(String(buf));
      } catch {
        return;
      }
      const now = nowFn();
      if (msg.type === "hello") {
        await (helloChain = helloChain.then(async () => {
          const result = enter(hall, msg.sessionId, msg.name, bannedWords, now);
          if (!result.ok) {
            ws.send(JSON.stringify({ type: "rejected", action: "hello", message: result.message }));
            return;
          }
          sessionId = msg.sessionId;
          const previous = sockets.get(sessionId);
          if (previous && previous !== ws) previous.close();
          sockets.set(sessionId, ws);
          await saver.saveNow(hall, now);
          broadcast();
          await new Promise((resolve) => setTimeout(resolve, 25));
        }));
        return;
      }
      if (!sessionId || !hall.people[sessionId]) return;
      if (msg.type === "offer") {
        const checked = checkText(msg.wish, "wish", bannedWords);
        if (!checked.ok) {
          ws.send(JSON.stringify({ type: "rejected", action: "offer", message: checked.message }));
          return;
        }
      }
      if (msg.type === "heartbeat") {
        heartbeat(hall, sessionId, now);
        await saver.saveHeartbeat(hall, now);
        return;
      }
      const result = msg.type === "move"
        ? move(hall, sessionId, msg.x, msg.y)
        : msg.type === "offer"
          ? offer(hall, sessionId, msg.wish, bannedWords, now)
          : msg.type === "exit"
            ? leave(hall, sessionId)
            : null;
      if (!result) return;
      if (!result.ok) {
        ws.send(JSON.stringify({ type: "rejected", action: msg.type, message: result.message }));
        return;
      }
      if (msg.type === "exit") sockets.delete(sessionId);
      await saver.saveNow(hall, now);
      broadcast();
    });
    ws.on("close", () => {
      if (sessionId && sockets.get(sessionId) === ws) sockets.delete(sessionId);
    });
  });

  const timer = options.sweepInterval === 0 ? null : setInterval(() => {
    const now = nowFn();
    const before = JSON.stringify(hall);
    sweep(hall, now);
    if (JSON.stringify(hall) !== before) saver.saveNow(hall, now).then(broadcast);
    else saver.flush(now);
  }, options.sweepInterval ?? SWEEP_MS);

  await new Promise((resolve) => httpServer.listen(options.port ?? 0, "127.0.0.1", resolve));
  return {
    port: httpServer.address().port,
    hall,
    sweep() {
      const now = nowFn();
      sweep(hall, now);
      return saver.saveNow(hall, now).then(broadcast);
    },
    close() {
      if (timer) clearInterval(timer);
      for (const client of wss.clients) {
        client.terminate();
      }
      sockets.clear();
      return new Promise((resolve) => {
        wss.close(() => {
          httpServer.closeAllConnections?.();
          httpServer.close(resolve);
        });
      });
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const hallFile = join(root, "data/hall.json");
  const wordsFile = join(root, "data/words.txt");
  const server = await createTempleServer({ hallFile, wordsFile, port: Number(process.env.PORT) || 3000 });
  console.log(`temple http://127.0.0.1:${server.port}`);
}
