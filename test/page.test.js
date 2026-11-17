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
