import { CENSER, CLIENT_HEARTBEAT_MS, DOOR_Y, INCENSE_MS, MOVE_Y, TEXT } from "/shared/constants.js";
import { checkText } from "/server/filter.js";
import { startAmbient } from "/ambient.js";
import { newlyLit, pixelToHall, readName, readSession, screenFor, shouldShowExit, writeName } from "/client-rules.js";

const app = document.querySelector("#app");
const phone = localStorage;
const page = sessionStorage;
let name = readName(phone);
let sessionId = readSession(page, () => `s${crypto.randomUUID()}`);
let socket = null;
let state = null;
let connected = false;
let sheet = false;
let toast = "";
let previousPeople = [];
let bowing = new Set();
let audioOn = false;
let bannedWords = [];

fetch("/data/words.txt").then((res) => res.text()).then((text) => {
  bannedWords = text.split(/\r?\n/u).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
}).catch(() => {});

function serverNow() {
  if (!state) return Date.now();
  return state.now + (Date.now() - state.receivedAt);
}

function connect() {
  socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`);
  socket.addEventListener("open", () => {
    connected = true;
    if (name) send({ type: "hello", name, sessionId });
    send({ type: "heartbeat" });
  });
  socket.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "rejected") {
      toast = msg.message;
      render();
      return;
    }
    if (msg.type === "state") {
      const lit = newlyLit(previousPeople, msg.people);
      previousPeople = msg.people;
      for (const id of lit) {
        bowing.add(id);
        setTimeout(() => { bowing.delete(id); render(); }, 1800);
      }
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
      writeName(phone, name);
      if (!audioOn) { startAmbient(); audioOn = true; }
      send({ type: "hello", name, sessionId });
    };
    return;
  }
  if (screen === "queue") {
    app.innerHTML = `<section class="screen queue"><h1>殿门</h1><p>已满 40 人</p><p>${name}</p><p>前面还有 ${state.queueAhead} 人</p>${exitButton()}</section>`;
    bindExit();
    return;
  }
  const people = state.people.filter((person) => person.place === "inside" || person.place === "outside");
  const wishes = state.people.filter((person) => person.incense && serverNow() - person.incense.litAt < INCENSE_MS);
  app.innerHTML = `<section class="${screen}">
    <div class="god">财神</div>
    <div class="censer" style="left:${CENSER.x * 100}%; top:36%">香炉</div>
    ${wishes.map((person, index) => `<div class="wish" style="top:${18 - index * 4}%">${person.name}：${person.incense.wish}</div>`).join("")}
    ${people.map((person) => `<div class="person ${bowing.has(person.sessionId) ? "bowing" : ""}" style="left:${person.x * 100}%; top:${yToPercent(person.y)}%">${person.name}</div>`).join("")}
    ${toast ? `<div class="toast">${toast}</div>` : ""}
    ${shouldShowExit(place) ? exitButton() : ""}
    ${sheet ? `<form class="sheet"><input id="wish" maxlength="20" placeholder="写下愿望"><p>${TEXT.wishLength}</p><button>上香</button></form>` : ""}
  </section>`;
  const floor = app.querySelector("section");
  floor.onclick = (event) => {
    if (event.target.closest(".sheet") || event.target.closest(".exit")) return;
    if (!audioOn) { startAmbient(); audioOn = true; }
    const rect = floor.getBoundingClientRect();
    const point = pixelToHall(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);
    send({ type: "move", x: point.x, y: point.y });
    const me = state.people.find((person) => person.sessionId === sessionId);
    if (me && nearAfterMove(point)) {
      if (me.incense && serverNow() - me.incense.litAt < INCENSE_MS) {
        toast = TEXT.incenseStill;
        sheet = false;
      } else {
        toast = "";
        sheet = true;
      }
      render();
    }
  };
  const form = app.querySelector("form");
  if (form) {
    form.onsubmit = (event) => {
      event.preventDefault();
      const wish = app.querySelector("#wish").value.trim();
      const checked = checkText(wish, "wish", bannedWords);
      if (!checked.ok) { toast = checked.message; render(); return; }
      send({ type: "offer", wish });
      sheet = false;
    };
  }
  bindExit();
}

function nearAfterMove(point) {
  const dx = point.x - CENSER.x;
  const dy = point.y - CENSER.y;
  return dx * dx + dy * dy <= CENSER.radius * CENSER.radius;
}

function yToPercent(y) {
  if (y > DOOR_Y) return 78 + ((y - DOOR_Y) / (MOVE_Y.max - DOOR_Y)) * 22;
  return 18 + ((y - MOVE_Y.min) / (DOOR_Y - MOVE_Y.min)) * 60;
}

function exitButton() {
  return `<button class="exit" type="button">退出</button>`;
}

function bindExit() {
  const button = app.querySelector(".exit");
  if (button) button.onclick = () => send({ type: "exit" });
}

setInterval(() => send({ type: "heartbeat" }), CLIENT_HEARTBEAT_MS);
connect();
render();
