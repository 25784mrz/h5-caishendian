export const HALL_CAP = 40;
export const INCENSE_MS = 180000;
export const HEARTBEAT_TIMEOUT_MS = 60000;
export const HEARTBEAT_SAVE_MS = 1000;
export const CLIENT_HEARTBEAT_MS = 15000;
export const SWEEP_MS = 5000;
export const DOOR_Y = 1;
export const ENTRY = { x: 0.5, y: 0.92 };
export const CENSER = { x: 0.5, y: 0.36, radius: 0.14 };
export const MOVE_X = { min: 0.08, max: 0.92 };
export const MOVE_Y = { min: 0.2, max: 1.15 };
export const TEXT = {
  charset: "只能用汉字和数字",
  nameLength: "名字要 2 到 6 个字",
  wishLength: "愿望要 1 到 20 个字",
  banned: "这句话不能用",
  incenseStill: "这炷香还在",
  goToCenser: "先走到香炉前",
  goOutside: "先走到殿外",
  reopening: "殿正在重新开门",
};

export function nearCenser(x, y) {
  const dx = x - CENSER.x;
  const dy = y - CENSER.y;
  return dx * dx + dy * dy <= CENSER.radius * CENSER.radius;
}
