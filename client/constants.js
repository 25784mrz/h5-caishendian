export const HALL_CAP = 40;
export const INCENSE_MS = 180000;
export const HEARTBEAT_TIMEOUT_MS = 60000;
export const HEARTBEAT_SAVE_MS = 1000;
export const CLIENT_HEARTBEAT_MS = 15000;
export const SWEEP_MS = 5000;
export const DOOR_Y = 1;
export const HALL_DOOR_Y = 0.62;
export const ENTRY = { x: 0.5, y: 0.92 };
export const CENSER = { x: 0.5, y: 0.67, radius: 0.11 };
export const GOD = { x: 0.5, y: 0.32, radius: 0.16 };
export const MOVE_X = { min: 0.08, max: 0.92 };
export const MOVE_Y = { min: 0.2, max: 1.15 };
export const DOOR_HALF = 0.24;
export const WALL_Y = [0.5, 0.84, 1];
export const TEXT = {
  charset: "只能用汉字和数字",
  nameLength: "名字要 2 到 6 个字",
  wishLength: "愿望要 1 到 20 个字",
  banned: "这句话不能用",
  incenseStill: "这炷香还在",
  goToCenser: "先走到香炉前",
  lightFirst: "先在香炉前上香",
  goOutside: "先走到殿外",
  reopening: "殿正在重新开门",
};

export function nearCenser(x, y) {
  const dx = x - CENSER.x;
  const dy = y - CENSER.y;
  return dx * dx + dy * dy <= CENSER.radius * CENSER.radius;
}

export function nearGod(x, y) {
  const dx = x - GOD.x;
  const dy = y - GOD.y;
  return dx * dx + dy * dy <= GOD.radius * GOD.radius;
}

export function stopAtWalls(from, to) {
  let best = 1;
  for (const wallY of WALL_Y) {
    const dy = to.y - from.y;
    if (dy === 0) continue;
    const t = (wallY - from.y) / dy;
    if (t <= 0 || t > 1) continue;
    const xAt = from.x + (to.x - from.x) * t;
    if (Math.abs(xAt - 0.5) <= DOOR_HALF) continue;
    if (t < best) best = t;
  }
  if (best === 1) return { x: to.x, y: to.y };
  const stop = Math.max(0, best - 1e-4);
  return {
    x: from.x + (to.x - from.x) * stop,
    y: from.y + (to.y - from.y) * stop,
  };
}
