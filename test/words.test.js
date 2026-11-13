import assert from "node:assert/strict";
import test from "node:test";
import { loadBannedWords } from "../server/words.js";

test("loads one word per line and skips blanks and comments", () => {
  const words = loadBannedWords("# 脏话\n傻逼\n\n# 广告\n加微信\n博彩\n");
  assert.deepEqual(words, ["傻逼", "加微信", "博彩"]);
});
