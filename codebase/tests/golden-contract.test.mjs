import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("CP3 golden set covers confident and uncertain regions", async () => {
  const url = new URL("./golden-region-cases.json", import.meta.url);
  const cases = JSON.parse(await readFile(url, "utf8"));
  assert.ok(cases.length >= 20);
  assert.ok(cases.some((item) => item.needsConfirmation === false));
  assert.ok(cases.some((item) => item.needsConfirmation === true));
  for (const item of cases) {
    assert.match(item.id, /^[a-z0-9-]+$/);
    if (item.expectedTokens) {
      assert.ok(Array.isArray(item.expectedTokens));
      assert.ok(item.expectedTokens.every((token) => typeof token === "string" && token));
    } else {
      assert.equal(item.needsConfirmation, true);
    }
    for (const key of ["x", "y", "width", "height"]) {
      assert.equal(typeof item.selection[key], "number");
      assert.ok(item.selection[key] >= 0 && item.selection[key] <= 100);
    }
  }
});
