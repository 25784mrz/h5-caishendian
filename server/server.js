import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { gesture, heartbeat, join as enter, leave, move, offer, snapshot, sweep } from "./hall.js";
import { createSaver } from "./saver.js";
import { readHallFile, writeHallFile } from "./store.js";
import { loadBannedWords } from "./words.js";
import { SWEEP_MS } from "./constants.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  "/": ["client/index.html", "text/html; charset=utf-8"],
  "/index.html": ["client/index.html", "text/html; charset=utf-8"],
  "/hall.js": ["client/hall.js", "text/javascript; charset=utf-8"],
  "/hall.css": ["client/hall.css", "text/css; charset=utf-8"],
  "/client-rules.js": ["client/client-rules.js", "text/javascript; charset=utf-8"],
  "/figures.js": ["client/figures.js", "text/javascript; charset=utf-8"],
  "/ambient.js": ["client/ambient.js", "text/javascript; charset=utf-8"],
  "/constants.js": ["client/constants.js", "text/javascript; charset=utf-8"],
  "/filter.js": ["client/filter.js", "text/javascript; charset=utf-8"],
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
  res.writeHead(200, { "content-type": match[1], "cache-control": "no-cache" });
  res.end(body);
}

export async function createTempleServer(options) {
  const nowFn = options.now ?? (() => Date.now());
  const hall = await readHallFile(options.hallFile, nowFn());
  const bannedWords = loadBannedWords(await readFile(options.wordsFile, "utf8"));
  const saver = createSaver((value) => writeHallFile(options.hallFile, value));
  const sockets = new Map();
  let hallQueue = Promise.resolve();
  let savePending = false;

  function broadcast() {
    const now = nowFn();
    for (const [sessionId, ws] of sockets) {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: "state", ...snapshot(hall, sessionId, now) }));
    }
  }

  function enqueueHallOperation(operation) {
    hallQueue = hallQueue.then(operation).catch((error) => {
      console.error(error);
    });
    return hallQueue;
  }

  async function saveAndBroadcast(save) {
    try {
      await save();
      savePending = false;
    } catch (error) {
      savePending = true;
      console.error(error);
      return false;
    }
    broadcast();
    return true;
  }

  async function saveHeartbeat(now) {
    const retrying = savePending;
    try {
      const wrote = await saver.saveHeartbeat(hall, now);
      if (retrying && wrote) {
        savePending = false;
        broadcast();
      }
    } catch (error) {
      savePending = true;
      console.error(error);
    }
  }

  async function retryPendingSave(wasPending, now) {
    if (wasPending && savePending) {
      await saveAndBroadcast(() => saver.saveNow(hall, now));
    }
  }

  function enqueueSweep(forceSave = false) {
    return enqueueHallOperation(async () => {
      const now = nowFn();
      const before = JSON.stringify(hall);
      sweep(hall, now);
      if (forceSave || savePending || JSON.stringify(hall) !== before) {
        await saveAndBroadcast(() => saver.saveNow(hall, now));
        return;
      }
      try {
        await saver.flush(now);
      } catch (error) {
        savePending = true;
        console.error(error);
      }
    });
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
    ws.on("message", (buf) => {
      let msg;
      try {
        msg = JSON.parse(String(buf));
      } catch {
        return;
      }
      enqueueHallOperation(async () => {
        const now = nowFn();
        const wasPending = savePending;
        if (msg.type === "hello") {
          if (sessionId !== null) {
            await retryPendingSave(wasPending, now);
            return;
          }
          const result = enter(hall, msg.sessionId, msg.name, bannedWords, now);
          if (!result.ok) {
            ws.send(JSON.stringify({ type: "rejected", action: "hello", message: result.message }));
            await retryPendingSave(wasPending, now);
            return;
          }
          sessionId = msg.sessionId;
          const previous = sockets.get(sessionId);
          if (previous && previous !== ws) previous.close();
          sockets.set(sessionId, ws);
          await saveAndBroadcast(() => saver.saveNow(hall, now));
          return;
        }
        if (!sessionId || !hall.people[sessionId]) {
          await retryPendingSave(wasPending, now);
          return;
        }
        if (msg.type === "heartbeat") {
          heartbeat(hall, sessionId, now);
          await saveHeartbeat(now);
          return;
        }
        const result = msg.type === "move"
          ? move(hall, sessionId, msg.x, msg.y, now)
          : msg.type === "gesture"
            ? gesture(hall, sessionId, msg.gesture)
          : msg.type === "offer"
            ? offer(hall, sessionId, msg.wish, bannedWords, now)
            : msg.type === "exit"
              ? leave(hall, sessionId)
              : null;
        if (!result) {
          await retryPendingSave(wasPending, now);
          return;
        }
        if (!result.ok) {
          ws.send(JSON.stringify({ type: "rejected", action: msg.type, message: result.message }));
          await retryPendingSave(wasPending, now);
          return;
        }
        if (msg.type === "exit") sockets.delete(sessionId);
        if (result.message) ws.send(JSON.stringify({ type: "rejected", action: msg.type, message: result.message }));
        await saveAndBroadcast(() => saver.saveNow(hall, now));
      });
    });
    ws.on("close", () => {
      if (sessionId && sockets.get(sessionId) === ws) sockets.delete(sessionId);
    });
  });

  const timer = options.sweepInterval === 0 ? null : setInterval(() => {
    enqueueSweep();
  }, options.sweepInterval ?? SWEEP_MS);

  await new Promise((resolve) => httpServer.listen(options.port ?? 0, "127.0.0.1", resolve));
  return {
    port: httpServer.address().port,
    hall,
    sweep() {
      return enqueueSweep(true);
    },
    close() {
      if (timer) clearInterval(timer);
      for (const client of wss.clients) {
        client.terminate();
      }
      sockets.clear();
      return hallQueue.then(() => {
        return new Promise((resolve) => {
          wss.close(() => {
            httpServer.closeAllConnections?.();
            httpServer.close(resolve);
          });
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
