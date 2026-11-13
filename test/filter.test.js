import assert from "node:assert/strict";
import test from "node:test";
import { TEXT } from "../shared/constants.js";
import { checkText } from "../server/filter.js";

const banned = ["傻逼", "加微信", "博彩"];

test("accepts a han and digit name", () => {
  assert.deepEqual(checkText("招财88", "name", banned), { ok: true });
});

test("charset is reported before length", () => {
  assert.equal(checkText("a", "name", banned).message, TEXT.charset);
  assert.equal(checkText("阿福！", "wish", banned).message, TEXT.charset);
});

test("length is reported before banned words", () => {
  assert.equal(checkText("福", "name", banned).message, TEXT.nameLength);
  assert.equal(checkText("", "wish", banned).message, TEXT.wishLength);
});

test("banned words are a substring and the word is not revealed", () => {
  assert.equal(checkText("加微信领红包", "wish", banned).message, TEXT.banned);
  assert.equal(checkText("傻逼", "name", banned).message, TEXT.banned);
});
