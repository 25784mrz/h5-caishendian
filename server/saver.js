export function createSaver(write, interval = 1000) {
  let last = -Infinity;
  let pending = null;

  async function writePending(hall, now) {
    pending = hall;
    await write(hall);
    if (pending === hall) pending = null;
    last = now;
  }

  return {
    async saveNow(hall, now = Date.now()) {
      await writePending(hall, now);
    },
    async saveHeartbeat(hall, now) {
      if (pending) {
        const pendingHall = pending;
        await writePending(pendingHall, now);
        if (hall !== pendingHall) pending = hall;
        return true;
      }
      if (now - last >= interval) {
        await writePending(hall, now);
        return true;
      }
      pending = hall;
      return false;
    },
    async flush(now) {
      if (!pending || now - last < interval) return false;
      const hall = pending;
      await writePending(hall, now);
      return true;
    },
  };
}
