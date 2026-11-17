import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("the page names the temple and can exit and reopen", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const js = await readFile(new URL("../public/hall.js", import.meta.url), "utf8");
  assert.match(html, /财神庙/);
  assert.match(js, /退出/);
  assert.match(js, /TEXT\.reopening/);
});

test("a rejected hello returns to naming without storing the attempt", async () => {
  const js = await readFile(new URL("../public/hall.js", import.meta.url), "utf8");
  assert.doesNotMatch(js, /name = next;\s*writeName\(phone, name\)/);
  assert.match(js, /msg\.action === "hello"[\s\S]*name = readName\(phone\)/);
  assert.match(js, /msg\.people\.find[\s\S]*writeName\(phone, name\)/);
  assert.match(js, /if \(!state\)[\s\S]*TEXT\.reopening/);
});
