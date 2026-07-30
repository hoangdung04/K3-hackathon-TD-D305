import { mkdir, readFile, writeFile } from "node:fs/promises";
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
    "regionTitle", "regionDescription", "confidence", "needsConfirmation", "requiresRedraw",
    "confirmationQuestion", "answerTitle", "answer", "evidence",
  ],
  properties: {
    regionTitle: { type: "string" },
    regionDescription: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    needsConfirmation: { type: "boolean" },
    requiresRedraw: { type: "boolean" },
    confirmationQuestion: { type: "string" },
    answerTitle: { type: "string" },
    answer: { type: "string" },
    evidence: { type: "string" },
  },
};

const results = [];
for (const item of golden) {
  const prompt = [
    "Bạn là VLearn Tutor. Hãy đọc vùng được chỉ định trên ảnh chụp giao diện slide.",
    "Slide 11 nằm ở bên trái phía trên ảnh, trong khung x=5.7%-61.6% và y=7.6%-44.8% của toàn ảnh.",
    `Tọa độ vùng sau đây tính tương đối bên trong riêng khung slide 11: ${JSON.stringify(item.selection)}.`,
    "Bỏ qua nét khoanh đỏ có sẵn trong ảnh; dùng hộp tọa độ được cung cấp làm nguồn vùng đánh giá.",
    "Nếu vùng chạm nhiều khối, hoặc đồng thời có tiêu đề và đoạn mô tả, hoặc quá nhỏ/mơ hồ: bắt buộc needsConfirmation=true và confidence dưới 0.7.",
    "Nếu vùng trống, chỉ có nét kẻ linh tinh hoặc dấu chấm: requiresRedraw=true, needsConfirmation=true, confidence không quá 0.49 và yêu cầu khoanh lại; không được cho phép tiếp tục với vùng đó.",
    "Nếu vùng chỉ có 1-2 từ, chỉ giải thích thẳng nếu đó là keyword/thuật ngữ/nhãn có nghĩa độc lập. Nếu là chữ cái hoặc mảnh câu chưa đủ ý, needsConfirmation=true, requiresRedraw=true, confidence không quá 0.49; confirmationQuestion chỉ xác định chữ/cụm đang khoanh nằm trong câu nào, không đoán ý hay gợi ý nội dung. Không bịa chữ không thấy trên ảnh.",
    "Chỉ trả kết quả theo schema.",
  ].join("\n");
  const startedAt = Date.now();
  try {
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
    if (!response.ok) throw new Error(payload?.error?.message || "OpenAI request failed");
    const result = JSON.parse(outputText(payload));
    const selectionTooSmall =
      item.selection.width <= 8 ||
      item.selection.height <= 8 ||
      item.selection.width * item.selection.height < 100;
    const effectiveNeedsConfirmation =
      result.needsConfirmation || result.confidence < 0.7 || selectionTooSmall;
    const effectiveConfidence = selectionTooSmall
      ? Math.min(result.confidence, 0.49)
      : result.confidence;
    const failures = [];
    if (item.needsConfirmation && !effectiveNeedsConfirmation) {
      failures.push("case rủi ro chưa yêu cầu xác nhận");
    }
    if (item.expectedTokens) {
      const actualTokens = new Set(normalize(result.regionTitle).toLowerCase().split(" "));
      const matched = item.expectedTokens.filter((token) => actualTokens.has(token));
      if (matched.length < (item.minimumTokenMatches || 1)) {
        failures.push(`nhận diện vùng thiếu token: ${item.expectedTokens.join(", ")}`);
      }
    }
    if (typeof item.minimumConfidence === "number" && effectiveConfidence < item.minimumConfidence) {
      failures.push(`confidence ${effectiveConfidence} thấp hơn ${item.minimumConfidence}`);
    }
    if (typeof item.maximumConfidence === "number" && effectiveConfidence > item.maximumConfidence) {
      failures.push(`confidence ${effectiveConfidence} cao hơn ${item.maximumConfidence}`);
    }
    results.push({
      id: item.id,
      category: item.category,
      pass: failures.length === 0,
      failures,
      confidence: effectiveConfidence,
      needsConfirmation: effectiveNeedsConfirmation,
      requiresRedraw: Boolean(result.requiresRedraw || selectionTooSmall),
      regionTitle: result.regionTitle,
      latencyMs: Date.now() - startedAt,
    });
  } catch (cause) {
    results.push({
      id: item.id,
      category: item.category,
      pass: false,
      failures: [cause instanceof Error ? cause.message : "Lỗi không xác định"],
      latencyMs: Date.now() - startedAt,
    });
  }
  const latest = results.at(-1);
  console.log(`${latest.pass ? "PASS" : "FAIL"} ${item.id}: ${latest.failures?.join("; ") || "ok"}`);
}

const passed = results.filter((item) => item.pass).length;
const report = {
  runAt: new Date().toISOString(),
  model,
  total: results.length,
  passed,
  passRate: Number((passed / results.length).toFixed(4)),
  results,
};
const reportDirectory = path.join(root, "..", "eval", "vision-live-runs");
await mkdir(reportDirectory, { recursive: true });
const reportPath = path.join(reportDirectory, `run-${report.runAt.replace(/[:.]/g, "-")}.json`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Vision golden eval đạt ${passed}/${results.length} case. Log: ${reportPath}`);
if (passed !== results.length) process.exitCode = 1;

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
