import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the VLearn CP3 Vision experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Khoanh để hỏi · VLearn Tutor CP3<\/title>/i);
  assert.match(html, /day04-prompt-engineering-tool-calling\.pdf/);
  assert.match(html, /VLearn Tutor/);
  assert.match(html, /Case chuẩn/);
  assert.match(html, /Case khó/);
  assert.match(html, /Tải nét khoanh/);
  assert.match(html, /Hoàn tác nét cuối/);
  assert.match(html, /Ngữ cảnh đã đồng bộ/);
  assert.doesNotMatch(html, /Your site is taking shape/);
  assert.doesNotMatch(html, /codex-preview/);
});
