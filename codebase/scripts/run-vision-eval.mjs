import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const env = await loadEnv(path.join(root, ".env.local"));
const apiKey = process.env.OPENAI_API_KEY || env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || env.OPENAI_MODEL || "gpt-5.6-terra";

if (!apiKey) {
  throw new Error("Thiếu OPENAI_API_KEY trong môi trường hoặc .env.local.");
}

const golden = JSON.parse(
  await readFile(path.join(root, "tests", "golden-region-cases.json"), "utf8"),
);
const image = `data:image/png;base64,${(
  await readFile(path.join(root, "cp2-flow-screenshot.png"))
).toString("base64")}`;

const schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "regionTitle", "regionDescription", "confidence", "needsConfirmation",
    "confirmationQuestion", "answerTitle", "answer", "evidence",
  ],
  properties: {
    regionTitle: { type: "string" },
    regionDescription: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    needsConfirmation: { type: "boolean" },
    confirmationQuestion: { type: "string" },
    answerTitle: { type: "string" },
    answer: { type: "string" },
    evidence: { type: "string" },
  },
};

for (const item of golden) {
  const prompt = [
    "Bạn là VLearn Tutor. Hãy đọc vùng được chỉ định trên ảnh chụp giao diện slide.",
    "Slide 11 nằm ở bên trái phía trên ảnh, trong khung x=5.7%-61.6% và y=7.6%-44.8% của toàn ảnh.",
    `Tọa độ vùng sau đây tính tương đối bên trong riêng khung slide 11: ${JSON.stringify(item.selection)}.`,
    "Bỏ qua nét khoanh đỏ có sẵn trong ảnh; dùng hộp tọa độ được cung cấp làm nguồn vùng đánh giá.",
    "Nếu vùng chạm nhiều khối, quá nhỏ hoặc mơ hồ: needsConfirmation=true và confidence dưới 0.7.",
    "Chỉ trả kết quả theo schema.",
  ].join("\n");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: "low" },
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: image, detail: "high" },
        ],
      }],
      text: {
        format: {
          type: "json_schema",
          name: "vlearn_golden_eval",
          strict: true,
          schema,
        },
        verbosity: "low",
      },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const payload = await response.json();
  assert.equal(
    response.ok,
    true,
    `${item.id}: ${payload?.error?.message || "OpenAI request failed"}`,
  );
  const text = outputText(payload);
  const result = JSON.parse(text);
  const effectiveNeedsConfirmation =
    result.needsConfirmation ||
    result.confidence < 0.7 ||
    item.selection.width <= 8 ||
    item.selection.height <= 8 ||
    item.selection.width * item.selection.height < 100;
  const selectionTooSmall =
    item.selection.width <= 8 ||
    item.selection.height <= 8 ||
    item.selection.width * item.selection.height < 100;
  const effectiveConfidence = selectionTooSmall
    ? Math.min(result.confidence, 0.49)
    : result.confidence;

  if (item.needsConfirmation) {
    assert.equal(
      effectiveNeedsConfirmation,
      true,
      `${item.id}: case rủi ro phải yêu cầu xác nhận`,
    );
  } else {
    const expectedTokens = normalize(item.expectedRegion).toLowerCase().split(" ");
    const actualTokens = new Set(normalize(result.regionTitle).toLowerCase().split(" "));
    const matchedTokens = expectedTokens.filter((token) => actualTokens.has(token));
    assert.ok(
      matchedTokens.length >= Math.ceil(expectedTokens.length * 0.66),
      `${item.id}: nhận diện sai vùng mong đợi`,
    );
  }
  if (typeof item.minimumConfidence === "number") {
    assert.ok(
      effectiveConfidence >= item.minimumConfidence,
      `${item.id}: confidence ${effectiveConfidence} thấp hơn ${item.minimumConfidence}`,
    );
  }
  if (typeof item.maximumConfidence === "number") {
    assert.ok(
      effectiveConfidence <= item.maximumConfidence,
      `${item.id}: confidence ${effectiveConfidence} cao hơn ${item.maximumConfidence}`,
    );
  }
  console.log(
    `PASS ${item.id}: confidence=${effectiveConfidence}, confirm=${effectiveNeedsConfirmation}`,
  );
}

console.log(`Vision golden eval đạt ${golden.length}/${golden.length} case.`);

function outputText(payload) {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") return content.text;
    }
  }
  throw new Error("OpenAI không trả output_text.");
}

function normalize(value) {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function loadEnv(file) {
  try {
    const source = await readFile(file, "utf8");
    return Object.fromEntries(
      source
        .split(/\r?\n/)
        .filter((line) => line && !line.trimStart().startsWith("#"))
        .map((line) => {
          const index = line.indexOf("=");
          return [
            line.slice(0, index).trim(),
            line.slice(index + 1).trim().replace(/^['"]|['"]$/g, ""),
          ];
        }),
    );
  } catch {
    return {};
  }
}
