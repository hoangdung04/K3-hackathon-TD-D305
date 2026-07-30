import {
  buildOpenAIRequest,
  applyRegionPolicy,
  extractOutputText,
  parseTutorAnalysis,
  type TutorRequest,
} from "../../lib/tutor-ai";
import {
  actorHash,
  countToday,
  ensureTutorSchema,
  getD1,
  saveAnalysis,
} from "../../../db/tutor-store";

export const runtime = "edge";
const MAX_IMAGE_LENGTH = 4_500_000;
const DAILY_LIMIT = 15;
const ALLOWED_IMAGE_PREFIXES = [
  "data:image/png;base64,",
  "data:image/jpeg;base64,",
  "data:image/webp;base64,",
];

function validSelection(selection: Partial<TutorRequest["selection"]> | undefined) {
  if (!selection) return false;
  const values = [selection.x, selection.y, selection.width, selection.height];
  return (
    values.every((value) => typeof value === "number" && Number.isFinite(value)) &&
    selection.x! >= 0 &&
    selection.y! >= 0 &&
    selection.width! > 0 &&
    selection.height! > 0 &&
    selection.x! + selection.width! <= 102 &&
    selection.y! + selection.height! <= 102
  );
}

function validImage(image: unknown) {
  return (
    typeof image === "string" &&
    ALLOWED_IMAGE_PREFIXES.some((prefix) => image.startsWith(prefix)) &&
    image.length <= MAX_IMAGE_LENGTH
  );
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as Partial<TutorRequest>;
    if (
      !validImage(input.image) ||
      (input.selectionImage !== undefined && !validImage(input.selectionImage)) ||
      typeof input.page !== "number" ||
      !Number.isInteger(input.page) ||
      input.page < 1 ||
      input.page > 10_000 ||
      typeof input.question !== "string" ||
      !input.question.trim() ||
      input.question.trim().length > 500 ||
      (input.queryScope !== "region" && input.queryScope !== "lesson") ||
      !validSelection(input.selection)
    ) {
      return Response.json({ error: "Dữ liệu câu hỏi hoặc ngữ cảnh slide không hợp lệ." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json(
        {
          error: "Tutor chưa được cấu hình OPENAI_API_KEY trên server. Hãy thêm key riêng vào .env.local rồi khởi động lại app.",
          code: "missing_api_key",
        },
        { status: 503 },
      );
    }

    const actor = await actorHash(request);
    let db: D1Database | null = null;
    let used = 0;
    try {
      db = await getD1();
      if (db) {
        await ensureTutorSchema(db);
        used = await countToday(db, actor);
      }
    } catch {
      // History is optional. A database outage must not block the live tutor response.
      db = null;
    }
    if (used >= DAILY_LIMIT) {
      return Response.json(
        { error: "Bạn đã dùng hết 15 câu Tutor trong hôm nay.", quota: { used, limit: DAILY_LIMIT } },
        { status: 429, headers: { "retry-after": "86400" } },
      );
    }

    const model = process.env.OPENAI_MODEL || "gpt-5.6-terra";
    const requestBody = buildOpenAIRequest(input as TutorRequest, model) as Record<string, unknown>;
    requestBody.safety_identifier = actor.slice(0, 64);
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(90_000),
    });
    const rawPayload = await upstream.text();
    let payload: unknown;
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      return Response.json(
        { error: "Dịch vụ AI trả về dữ liệu không hợp lệ. Hãy thử lại." },
        { status: 502 },
      );
    }
    if (!upstream.ok) {
      const maybeError = payload as { error?: { message?: string } };
      return Response.json(
        { error: maybeError.error?.message || "Entropy tạm thời không phản hồi." },
        { status: upstream.status },
      );
    }
    const analysis = applyRegionPolicy(
      parseTutorAnalysis(extractOutputText(payload)),
      input.selection,
    );
    if (db) {
      try {
        await saveAnalysis(db, actor, input.page, input.question.trim(), analysis);
      } catch {
        // Deliver the answer even if saving history fails.
      }
    }
    return Response.json({
      analysis,
      quota: { used: used + 1, limit: DAILY_LIMIT },
    });
  } catch (cause) {
    return Response.json(
      { error: cause instanceof Error ? cause.message : "Không thể phân tích vùng khoanh." },
      { status: 500 },
    );
  }
}
