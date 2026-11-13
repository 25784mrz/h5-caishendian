export function createSaver(write, interval = 1000) {
  let last = -Infinity;
  let pending = null;
  return {
    async saveNow(hall, now = Date.now()) {
      pending = null;
      last = now;
      await write(hall);
    },
    async saveHeartbeat(hall, now) {
      if (now - last >= interval) {
        pending = null;
        last = now;
        await write(hall);
        return;
      }
      pending = hall;
    },
    async flush(now) {
      if (!pending || now - last < interval) return;
      const hall = pending;
      pending = null;
      last = now;
      await write(hall);
    },
  };
}
