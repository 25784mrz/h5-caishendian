import { CENSER, CLIENT_HEARTBEAT_MS, GOD, INCENSE_MS, MOVE_X, TEXT, stopAtWalls } from "./constants.js";
import { checkText } from "./filter.js";
import { startAmbient } from "/ambient.js";
import { quietName, readName, readSession, screenFor, shouldShowExit, stepToward, writeName } from "/client-rules.js";
import { censerFigure, godFigure, personFigure } from "/figures.js";

const app = document.querySelector("#app");
const phone = localStorage;
const page = sessionStorage;
let name = quietName(phone);
let sessionId = readSession(page, () => `s${crypto.randomUUID()}`);
let socket = null;
let state = null;
let connected = false;
let acceptedOnSocket = false;
let toast = "";
const visual = new Map();
let audio = null;
let audioOn = false;
let bannedWords = [];
let palmsOn = false;
let bowMode = false;
let bowSent = false;
let sheet = false;
let incenseMode = false;
const CUSHION = { x: GOD.x, y: 0.46 };
const SIDE_DOORS = {
  treasure: { x: 0.1786, y: 0.6175 },
  jewel: { x: 0.8214, y: 0.6175 },
};
const SHRINES = {
  blessing: {
    title: "赐福殿", god: "赐福天官", line: "天官赐福", tone: "blessing",
    exit: "front", through: "court", yard: "court",
    godAt: { x: 0.32, y: 0.34 }, cushion: { x: 0.32, y: 0.56 },
  },
  treasure: {
    title: "招宝殿", god: "萧升", line: "招宝天尊", tone: "treasure",
    exit: "court", through: null, yard: "court",
    godAt: { x: 0.5, y: 0.34 }, cushion: { x: 0.5, y: 0.56 },
  },
  jewel: {
    title: "纳珍殿", god: "曹宝", line: "纳珍天尊", tone: "jewel",
    exit: "court", through: null, yard: "court",
    godAt: { x: 0.5, y: 0.34 }, cushion: { x: 0.5, y: 0.56 },
  },
};
const SCENES = {
  gate: { y0: 1, y1: 1.15, forward: { y: 1, to: "front" }, back: null },
  front: { y0: 0.84, y1: 1, forward: { y: 0.84, to: "court" }, back: { y: 1, to: "gate" } },
  court: { y0: 0.5, y1: 0.84, forward: { y: 0.5, to: "inside" }, back: { y: 0.84, to: "front" } },
  inside: { y0: 0.2, y1: 0.5, forward: null, back: { y: 0.5, to: "court" } },
  blessing: { y0: 0, y1: 1, local: true, forward: { y: 0.14, to: "court" }, back: { y: 0.9, to: "front" } },
  treasure: { y0: 0, y1: 1, local: true, forward: null, back: { y: 0.9, to: "court" } },
  jewel: { y0: 0, y1: 1, local: true, forward: null, back: { y: 0.9, to: "court" } },
};
let sceneId = "gate";
let scenePlaced = false;
let pose = null;
let doorHold = false;

function placeScene(y) {
  if (y >= 1) return "gate";
  if (y >= 0.84) return "front";
  if (y >= 0.5) return "court";
  return "inside";
}

function nearDoor(body, door) {
  if (!door || !body) return false;
  return Math.abs(body.x - 0.5) < 0.24 && Math.abs(body.y - door.y) < 0.14;
}

function nearPoint(body, point) {
  if (!body || !point) return false;
  return Math.hypot(body.x - point.x, body.y - point.y) < 0.12;
}

function godMarkup(tone, at, name, line) {
  return `<div class="god upright" style="left:${at.x * 100}%; top:${yToPercent(at.y)}%">${godFigure(tone)}<span class="god-name">${line}<br>${name}</span></div>`;
}

function sideHall(side, title, open) {
  return `<div class="side-hall ${side}" style="--hw:210px;--hh:220px;--hd:80px">${buildingShell(title, open)}</div>`;
}

const YARD_WALLS = { front: "山门", court: "赐福殿", inside: "财神殿" };

function yardWall(title, open) {
  return `<div class="gate-wall"><div class="gate-wall-face"><div class="plaque">${title}</div><div class="gate-door ${open ? "open" : ""}"><i class="leaf left"></i><i class="leaf right"></i></div></div></div>`;
}

function buildingShell(title, open) {
  const door = open == null ? "" : `<div class="gate-door ${open ? "open" : ""}"><i class="leaf left"></i><i class="leaf right"></i></div>`;
  return `<div class="shell"><i class="ft"></i><i class="bk"></i><i class="lf"></i><i class="rt"></i><i class="rf"></i><div class="plaque">${title}</div>${door}</div>`;
}

function hallFace(kind, title, open) {
  const size = { shanmen: ["560px", "300px", "120px"], "front-hall": ["740px", "360px", "140px"], main: ["980px", "420px", "170px"] };
  const [w, h, d] = size[kind];
  return `<div class="house hall-block ${kind}" style="--hw:${w};--hh:${h};--hd:${d}">${buildingShell(title, open)}</div>`;
}

function roomFace(tone, title, farOpen) {
  const door = farOpen == null ? "" : `<div class="far-door ${farOpen ? "open" : ""}"><i class="leaf left"></i><i class="leaf right"></i></div>`;
  return `<div class="room ${tone}"><div class="room-wall far"><div class="plaque">${title}</div>${door}</div><div class="room-wall side l"></div><div class="room-wall side r"></div></div>`;
}

fetch("/data/words.txt").then((res) => res.text()).then((text) => {
  bannedWords = text.split(/\r?\n/u).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
}).catch(() => {});

function connect() {
  socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`);
  socket.addEventListener("open", () => {
    acceptedOnSocket = false;
    scenePlaced = false;
    connected = true;
    if (name) send({ type: "hello", name, sessionId });
    send({ type: "heartbeat" });
  });
  socket.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "rejected") {
      toast = msg.message;
      if (msg.action === "hello") {
        const storedName = readName(phone);
        if (!acceptedOnSocket && storedName && storedName === name) {
          name = "";
          writeName(phone, "");
        } else {
          name = storedName;
        }
      }
      render();
      return;
    }
    if (msg.type === "state") {
      const me = msg.people.find((person) => person.sessionId === sessionId);
      if (me) {
        acceptedOnSocket = true;
        name = me.name;
        if (readName(phone) !== name) writeName(phone, name);
        if (!scenePlaced) {
          sceneId = placeScene(me.y);
          scenePlaced = true;
        }
      }
      syncVisual(msg.people);
      state = { ...msg, receivedAt: Date.now() };
      connected = true;
      render();
    }
  });
  socket.addEventListener("close", () => {
    connected = false;
    render();
    setTimeout(connect, 1000);
  });
}

function send(msg) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

function placeOfYou() {
  return state?.people?.find((person) => person.sessionId === sessionId)?.place ?? state?.place ?? null;
}

function render() {
  const place = connected ? placeOfYou() : null;
  const screen = screenFor({ name, place: connected ? place : null });
  if (!connected && name) {
    app.innerHTML = `<section class="screen reopening"><h1>${TEXT.reopening}</h1></section>`;
    return;
  }
  if (screen === "name") {
    app.innerHTML = `<section class="screen name"><h1>财神庙</h1><input id="name" maxlength="6" placeholder="起个名字"><p>${TEXT.nameLength}</p><button id="enter">进殿</button><p>${toast}</p></section>`;
    app.querySelector("#enter").onclick = () => {
      const next = app.querySelector("#name").value.trim();
      const checked = checkText(next, "name", bannedWords);
      if (!checked.ok) { toast = checked.message; render(); return; }
      name = next;
      if (!audio) { audio = startAmbient(); audioOn = true; }
      send({ type: "hello", name, sessionId });
    };
    return;
  }
  if (!state) {
    app.innerHTML = `<section class="screen reopening"><h1>${TEXT.reopening}</h1></section>`;
    return;
  }
  if (screen === "queue") {
    app.innerHTML = `<section class="screen queue"><h1>殿门</h1><p>已满 40 人</p><p>${name}</p><p>前面还有 ${state.queueAhead} 人</p>${exitButton()}</section>`;
    bindExit();
    return;
  }
  const here = SCENES[sceneId];
  const shrine = SHRINES[sceneId];
  const mine = visual.get(sessionId);
  const actor = shrine && pose ? pose : mine;
  const forwardOpen = nearDoor(actor, here.forward);
  const backOpen = nearDoor(actor, here.back);
  const seen = (y) => y >= here.y0 - 0.05 && y <= here.y1 + 0.05;
  const people = state.people.filter((person) => {
    if (person.place !== "inside" && person.place !== "outside") return false;
    if (shrine) return person.sessionId === sessionId;
    const body = visual.get(person.sessionId) ?? person;
    return seen(body.y);
  });
  const showCenser = !shrine && CENSER.y >= here.y0 && CENSER.y < here.y1;
  const showGod = !shrine && GOD.y >= here.y0 && GOD.y < here.y1;
  const showCushion = !shrine && CUSHION.y >= here.y0 && CUSHION.y < here.y1;
  const wishes = showCenser ? state.people.filter((person) => person.incense && serverNow() - person.incense.litAt < INCENSE_MS) : [];
  const censerTop = yToPercent(CENSER.y);
  const draft = app.querySelector("#wish")?.value ?? "";
  const mats = sceneId === "court"
    ? Object.values(SIDE_DOORS).map((door) => `<div class="side-mat" style="left:${door.x * 100}%; top:${yToPercent(door.y)}%">入殿</div>`).join("")
    : "";
  const face = shrine
    ? roomFace(shrine.tone, shrine.title, shrine.through ? forwardOpen : null)
    : sceneId === "gate"
      ? `${hallFace("shanmen", "山门", forwardOpen)}`
      : sceneId === "front"
        ? `${hallFace("front-hall", "赐福殿", forwardOpen)}`
        : sceneId === "court"
          ? `${hallFace("main", "财神殿", forwardOpen)}${sideHall("left", "招宝殿", nearPoint(mine, SIDE_DOORS.treasure))}${sideHall("right", "纳珍殿", nearPoint(mine, SIDE_DOORS.jewel))}<div class="bell" style="--hw:96px;--hh:300px;--hd:76px">${buildingShell("钟楼", null)}</div>`
          : roomFace("zhao", "财神殿", null);
  const backDoor = here.back && !YARD_WALLS[sceneId] ? `<div class="back-door ${backOpen ? "open" : ""}"><i class="leaf left"></i><i class="leaf right"></i></div>` : "";
  app.innerHTML = `<section class="${screen}">
    <div class="stage ${sceneId}">
      <div class="world">
        <div class="tilt">
          <div class="floor">
            <div class="zone court-floor"></div>
            <div class="carpet"></div>
            ${face}
            ${here.forward ? `<div class="sill"></div>` : ""}
            ${showCushion ? `<div class="cushion" style="left:${CUSHION.x * 100}%; top:${yToPercent(CUSHION.y)}%"></div>` : ""}
            ${shrine ? `<div class="cushion" style="left:${shrine.cushion.x * 100}%; top:${yToPercent(shrine.cushion.y)}%"></div>` : ""}
            ${mats}
            ${YARD_WALLS[sceneId] ? yardWall(YARD_WALLS[sceneId], backOpen) : ""}
            ${floorCells()}
            ${showGod ? godMarkup("zhao", GOD, "赵公明", "正财神") : ""}
            ${shrine ? godMarkup(shrine.tone, shrine.godAt, shrine.god, shrine.line) : ""}
            ${showCenser ? `<div class="censer upright" style="left:${CENSER.x * 100}%; top:${censerTop}%">${censerFigure()}</div>` : ""}
            ${wishes.map((person, index) => `<div class="wish" style="left:50%; top:${censerTop - 10 - index * 6}%">${person.name}：${person.incense.wish}</div>`).join("")}
            ${people.map((person) => {
              const body = person.sessionId === sessionId && pose && shrine ? pose : (visual.get(person.sessionId) ?? person);
              const bowing = person.gesture === "bow" || (person.sessionId === sessionId && bowSent);
              const palms = person.gesture === "palms" || (person.sessionId === sessionId && palmsOn && !bowMode);
              const label = person.sessionId === sessionId ? `我：${person.name}` : person.name;
              return `<div class="person ${bowing ? "bowing" : ""} ${palms ? "palms" : ""}" data-id="${person.sessionId}" style="left:${body.x * 100}%; top:${yToPercent(body.y)}%; --yaw:${body.yaw || 0}deg"><div class="shadow"></div><div class="stand">${personFigure()}</div><span class="name">${label}</span></div>`;
            }).join("")}
            ${backDoor}
          </div>
        </div>
      </div>
    </div>
    ${shrine || sceneId === "inside" ? `<div class="hall-title">${shrine ? shrine.title : "财神殿"}</div>` : ""}
    ${shrine || sceneId === "inside" ? `<button id="pray" class="pray" type="button">${bowMode ? "停下" : "祈福"}</button>` : ""}
    ${toast ? `<div class="toast">${toast}</div>` : ""}
    <div class="quiet">
      <button id="incense" type="button">焚香</button>
      <button id="palms" type="button">${palmsOn && !bowMode ? "放下" : "合掌"}</button>
      <button id="bow" type="button">${bowMode ? "停下" : "叩拜"}</button>
      <button id="sound" type="button">${audioOn ? "静音" : "声音"}</button>
    </div>
    ${shouldShowExit(place) ? exitButton() : ""}
    ${sheet ? `<form class="sheet"><input id="wish" maxlength="20" placeholder="写下愿望"><p>${TEXT.wishLength}</p><button>上香</button></form>` : ""}
  </section>`;
  const floor = app.querySelector(".floor");
  floor.onclick = (event) => {
    const cell = event.target.closest(".cell");
    if (!cell) return;
    if (!audio) { audio = startAmbient(); audioOn = true; }
    const point = { x: Number(cell.dataset.x), y: Number(cell.dataset.y) };
    if (bowMode) stopBow();
    const closeSheet = sheet;
    incenseMode = false;
    sheet = false;
    if (pose && SHRINES[sceneId]) {
      pose.tx = point.x;
      pose.ty = point.y;
      if (closeSheet) render();
      return;
    }
    send({ type: "move", x: point.x, y: point.y });
    if (closeSheet) render();
  };
  const form = app.querySelector("form");
  if (form) {
    const input = app.querySelector("#wish");
    if (draft) input.value = draft;
    input.focus();
    form.onsubmit = (event) => {
      event.preventDefault();
      const wish = input.value.trim();
      const checked = checkText(wish, "wish", bannedWords);
      if (!checked.ok) { toast = checked.message; render(); return; }
      send({ type: "offer", wish });
      sheet = false;
      toast = "";
    };
  }
  bindQuiet();
  bindExit();
  aimCamera();
}

function serverNow() {
  if (!state) return Date.now();
  return state.now + (Date.now() - state.receivedAt);
}

function me() {
  return state?.people?.find((person) => person.sessionId === sessionId);
}

function incenseBurning(person) {
  return Boolean(person?.incense) && serverNow() - person.incense.litAt < INCENSE_MS;
}

function atCenser(person) {
  if (!person) return false;
  const body = visual.get(person.sessionId) ?? person;
  const dx = body.x - CENSER.x;
  const dy = body.y - CENSER.y;
  return dx * dx + dy * dy <= CENSER.radius * CENSER.radius;
}

function startIncense() {
  if (SHRINES[sceneId]) {
    doorHold = true;
    pose = null;
    sceneId = SHRINES[sceneId].yard;
  }
  const person = me();
  if (incenseBurning(person)) {
    incenseMode = false;
    sheet = false;
    toast = TEXT.incenseStill;
    render();
    return;
  }
  if (bowMode) stopBow();
  toast = "";
  if (atCenser(person)) {
    incenseMode = false;
    sheet = true;
    render();
    return;
  }
  sheet = false;
  incenseMode = true;
  send({ type: "move", x: CENSER.x, y: CENSER.y });
  render();
}

function syncVisual(people) {
  const shown = people.filter((person) => person.place === "inside" || person.place === "outside");
  const ids = new Set(shown.map((person) => person.sessionId));
  for (const id of visual.keys()) {
    if (!ids.has(id)) {
      visual.delete(id);
    }
  }
  for (const person of shown) {
    const body = visual.get(person.sessionId);
    if (!body) visual.set(person.sessionId, { x: person.x, y: person.y, tx: person.x, ty: person.y, yaw: 0, moving: false });
    else {
      body.tx = person.x;
      body.ty = person.y;
    }
  }
}

function startBow() {
  palmsOn = false;
  bowMode = true;
  bowSent = false;
  send({ type: "gesture", gesture: "" });
  const hall = SHRINES[sceneId];
  if (hall && pose) {
    pose.tx = hall.cushion.x;
    pose.ty = hall.cushion.y;
    return;
  }
  send({ type: "move", x: CUSHION.x, y: CUSHION.y });
}

function stopBow() {
  bowMode = false;
  bowSent = false;
  send({ type: "gesture", gesture: "" });
}

function bindQuiet() {
  app.querySelector("#incense").onclick = () => startIncense();
  app.querySelector("#palms").onclick = () => {
    if (bowMode) stopBow();
    palmsOn = !palmsOn;
    send({ type: "gesture", gesture: palmsOn ? "palms" : "" });
    render();
  };
  app.querySelector("#bow").onclick = () => {
    if (bowMode) stopBow();
    else startBow();
    render();
  };
  const pray = app.querySelector("#pray");
  if (pray) pray.onclick = () => {
    if (bowMode) stopBow();
    else startBow();
    render();
  };
  app.querySelector("#sound").onclick = () => {
    if (!audio) audio = startAmbient();
    audioOn = !audioOn;
    audio.setOn(audioOn);
    render();
  };
}

function paintWalk() {
  for (const [id, body] of visual) {
    const el = app.querySelector(`.person[data-id="${CSS.escape(id)}"]`);
    if (!el) continue;
    const actor = id === sessionId && pose && SHRINES[sceneId] ? pose : body;
    el.style.left = `${actor.x * 100}%`;
    el.style.top = `${yToPercent(actor.y)}%`;
    el.style.setProperty("--yaw", `${actor.yaw || 0}deg`);
    el.classList.toggle("walking", Boolean(actor.moving) && !el.classList.contains("bowing"));
  }
  aimCamera();
}

function aimCamera() {
  const world = app.querySelector(".world");
  const floor = app.querySelector(".floor");
  const body = pose && SHRINES[sceneId] ? pose : visual.get(sessionId);
  if (!world || !floor || !body) return;
  const here = SCENES[sceneId];
  const px = floor.offsetLeft + body.x * floor.offsetWidth;
  const t = Math.min(1, Math.max(0, (body.y - here.y0) / (here.y1 - here.y0)));
  const py = floor.offsetTop + t * floor.offsetHeight;
  const camX = Math.min(world.offsetWidth - 750, Math.max(0, px - 375));
  const camY = Math.min(world.offsetHeight - 1334, Math.max(0, py - 1334 * 0.7));
  world.style.transform = `translate(${-camX}px, ${-camY}px)`;
}

let lastTick = 0;
function tick(now) {
  const dt = lastTick ? Math.min(0.05, (now - lastTick) / 1000) : 0;
  lastTick = now;
  let needRender = false;
  for (const [id, body] of visual) {
    const goal = stopAtWalls(body, { x: body.tx, y: body.ty });
    const next = stepToward(body, goal, dt);
    if (!next.arrived) body.yaw = Math.atan2(goal.x - body.x, goal.y - body.y) * 180 / Math.PI;
    body.moving = !next.arrived;
    body.x = next.x;
    body.y = next.y;
    if (bowMode && !bowSent && id === sessionId && next.arrived && Math.hypot(body.x - CUSHION.x, body.y - CUSHION.y) < 0.03) {
      bowSent = true;
      send({ type: "gesture", gesture: "bow" });
      needRender = true;
    }
    if (incenseMode && id === sessionId && next.arrived && Math.hypot(body.x - CENSER.x, body.y - CENSER.y) < 0.03) {
      incenseMode = false;
      sheet = true;
      needRender = true;
    }
  }
  if (pose && SHRINES[sceneId]) {
    const hall = SHRINES[sceneId];
    const goal = { x: pose.tx, y: pose.ty };
    const next = stepToward(pose, goal, dt);
    if (!next.arrived) pose.yaw = Math.atan2(goal.x - pose.x, goal.y - pose.y) * 180 / Math.PI;
    pose.moving = !next.arrived;
    pose.x = next.x;
    pose.y = next.y;
    if (bowMode && !bowSent && next.arrived && Math.hypot(pose.x - hall.cushion.x, pose.y - hall.cushion.y) < 0.03) {
      bowSent = true;
      send({ type: "gesture", gesture: "bow" });
      needRender = true;
    }
  }
  const switched = SHRINES[sceneId] ? followShrine() : followDoors() || trySideDoors();
  refreshHold();
  if (needRender || switched) render();
  else {
    paintWalk();
    paintDoors();
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

function followDoors() {
  const body = visual.get(sessionId);
  const here = SCENES[sceneId];
  if (!body || !here) return false;
  if (here.forward && nearDoor(body, here.forward) && body.y < here.forward.y) {
    if (sceneId === "front" && !incenseMode) {
      if (!doorHold) enterShrine("blessing");
      return !doorHold;
    }
    sceneId = here.forward.to;
    return true;
  }
  if (here.back && nearDoor(body, here.back) && body.y > here.back.y) {
    sceneId = here.back.to;
    return true;
  }
  return false;
}

function followShrine() {
  const here = SCENES[sceneId];
  const hall = SHRINES[sceneId];
  if (!pose || !here || !hall) return false;
  if (here.back && nearDoor(pose, here.back) && pose.y > here.back.y) {
    leaveShrine(hall.exit);
    return true;
  }
  if (hall.through && here.forward && nearDoor(pose, here.forward) && pose.y < here.forward.y) {
    leaveShrine(hall.through);
    return true;
  }
  return false;
}

function trySideDoors() {
  if (sceneId !== "court" || doorHold || incenseMode || bowMode) return false;
  const body = visual.get(sessionId);
  if (!body || body.moving) return false;
  for (const [id, door] of Object.entries(SIDE_DOORS)) {
    if (nearPoint(body, door) && nearPoint({ x: body.tx, y: body.ty }, door)) return enterShrine(id);
  }
  return false;
}

function enterShrine(id) {
  if (doorHold || incenseMode || !SHRINES[id]) return false;
  if (bowMode) stopBow();
  sceneId = id;
  pose = { x: 0.5, y: 0.72, tx: 0.5, ty: 0.72, yaw: 0, moving: false };
  if (id === "blessing") {
    const body = visual.get(sessionId);
    if (body) {
      body.tx = 0.5;
      body.ty = Math.min(body.y, 0.82);
      send({ type: "move", x: 0.5, y: 0.82 });
    }
  }
  return true;
}

function leaveShrine(next) {
  if (bowMode) stopBow();
  const returning = sceneId === "blessing" && next === "front";
  doorHold = true;
  pose = null;
  sceneId = next;
  if (returning) send({ type: "move", x: 0.5, y: 0.92 });
}

function refreshHold() {
  if (!doorHold) return;
  const body = visual.get(sessionId);
  if (!body) return;
  const atFrontDoor = nearDoor(body, SCENES.front.forward) && body.y < 0.9;
  const atSide = Object.values(SIDE_DOORS).some((door) => Math.hypot(body.x - door.x, body.y - door.y) < 0.2);
  if (!atFrontDoor && !atSide) doorHold = false;
}

function paintDoors() {
  const body = visual.get(sessionId);
  const here = SCENES[sceneId];
  const actor = pose && SHRINES[sceneId] ? pose : body;
  app.querySelector(".hall-block .gate-door")?.classList.toggle("open", nearDoor(actor, here?.forward));
  app.querySelector(".back-door")?.classList.toggle("open", nearDoor(actor, here?.back));
  app.querySelector(".gate-wall .gate-door")?.classList.toggle("open", nearDoor(actor, here?.back));
  app.querySelector(".far-door")?.classList.toggle("open", nearDoor(actor, here?.forward));
  if (sceneId === "court" && body) {
    app.querySelector(".side-hall.left .gate-door")?.classList.toggle("open", nearPoint(body, SIDE_DOORS.treasure));
    app.querySelector(".side-hall.right .gate-door")?.classList.toggle("open", nearPoint(body, SIDE_DOORS.jewel));
  }
}

function floorCells() {
  const here = SCENES[sceneId];
  const cols = 14;
  const rows = 12;
  const yLo = here.local ? 0.02 : here.y0 - (here.forward ? 0.04 : 0);
  const yHi = here.local ? 0.98 : here.y1 + (here.back ? 0.04 : 0);
  const parts = [];
  for (let row = 0; row < rows; row += 1) {
    const y0 = yLo + (row / rows) * (yHi - yLo);
    const y1 = yLo + ((row + 1) / rows) * (yHi - yLo);
    const top = yToPercent(y0);
    const height = yToPercent(y1) - top;
    if (top > 104 || top + height < -8) continue;
    for (let col = 0; col < cols; col += 1) {
      const x0 = col / cols;
      const x1 = (col + 1) / cols;
      const rawX = (x0 + x1) / 2;
      const x = here.local ? rawX : Math.min(MOVE_X.max, Math.max(MOVE_X.min, rawX));
      const y = (y0 + y1) / 2;
      parts.push(`<div class="cell" data-x="${x}" data-y="${y}" style="left:${x0 * 100}%;top:${top}%;width:${(x1 - x0) * 100}%;height:${height}%"></div>`);
    }
  }
  return parts.join("");
}

function yToPercent(y) {
  const here = SCENES[sceneId];
  return ((y - here.y0) / (here.y1 - here.y0)) * 100;
}

function exitButton() {
  return `<button class="exit" type="button">退出</button>`;
}

function bindExit() {
  const button = app.querySelector(".exit");
  if (button) button.onclick = () => send({ type: "exit" });
}

function fitFrame() {
  const scale = Math.min(window.innerWidth / 750, window.innerHeight / 1334);
  app.style.position = "fixed";
  app.style.transformOrigin = "top left";
  app.style.transform = `scale(${scale})`;
  app.style.left = `${(window.innerWidth - 750 * scale) / 2}px`;
  app.style.top = `${(window.innerHeight - 1334 * scale) / 2}px`;
}
window.addEventListener("resize", fitFrame);
fitFrame();
setInterval(() => send({ type: "heartbeat" }), CLIENT_HEARTBEAT_MS);
connect();
render();
