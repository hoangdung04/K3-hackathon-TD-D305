export type TutorRequest = {
  image: string;
  page: number;
  question: string;
  selection: { x: number; y: number; width: number; height: number };
};

export const tutorAnalysisSchema = {
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
} as const;

export function buildTutorPrompt(input: TutorRequest) {
  return [
    "Bạn là VLearn Tutor, trợ giảng tiếng Việt đọc nội dung trong vùng học viên khoanh trên slide.",
    "Ảnh gồm toàn bộ slide và nét bút đỏ. Hộp tọa độ chuẩn hóa theo phần trăm:",
    JSON.stringify(input.selection),
    `Trang: ${input.page}. Câu hỏi: ${input.question}`,
    "Xác định nội dung nằm trong hoặc sát nét khoanh; không suy diễn nội dung không thấy trên ảnh.",
    "Nếu vùng chạm nhiều khối nội dung, quá nhỏ hoặc mơ hồ: needsConfirmation=true và confidence dưới 0.7.",
    "confirmationQuestion hỏi lại ngắn gọn. answer giải thích đúng trọng tâm bằng tiếng Việt, 2-4 câu.",
    "evidence mô tả ngắn phần chữ nhìn thấy trên slide. Không bịa nguồn bên ngoài.",
  ].join("\n");
}

export function buildOpenAIRequest(input: TutorRequest, model: string) {
  return {
    model,
    reasoning: { effort: "low" },
    input: [{
      role: "user",
      content: [
        { type: "input_text", text: buildTutorPrompt(input) },
        { type: "input_image", image_url: input.image, detail: "high" },
      ],
    }],
    text: {
      format: {
        type: "json_schema",
        name: "vlearn_region_analysis",
        strict: true,
        schema: tutorAnalysisSchema,
      },
      verbosity: "low",
    },
  };
}

export function extractOutputText(payload: unknown): string {
  if (!payload || typeof payload !== "object") throw new Error("Phản hồi AI không hợp lệ.");
  const direct = (payload as { output_text?: unknown }).output_text;
  if (typeof direct === "string" && direct) return direct;
  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) throw new Error("AI không trả về nội dung.");
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
    }
  }
  throw new Error("AI không trả về nội dung.");
}

export function parseTutorAnalysis(text: string) {
  const value = JSON.parse(text) as Record<string, unknown>;
  const strings = [
    "regionTitle", "regionDescription", "confirmationQuestion",
    "answerTitle", "answer", "evidence",
  ];
  if (
    strings.some((key) => typeof value[key] !== "string") ||
    typeof value.confidence !== "number" ||
    value.confidence < 0 ||
    value.confidence > 1 ||
    typeof value.needsConfirmation !== "boolean"
  ) {
    throw new Error("AI trả về dữ liệu không đúng cấu trúc.");
  }
  const analysis = value as {
    regionTitle: string;
    regionDescription: string;
    confidence: number;
    needsConfirmation: boolean;
    confirmationQuestion: string;
    answerTitle: string;
    answer: string;
    evidence: string;
  };
  return {
    ...analysis,
    needsConfirmation:
      analysis.needsConfirmation || analysis.confidence < 0.7,
  };
}

export function applyRegionPolicy(
  analysis: ReturnType<typeof parseTutorAnalysis>,
  selection: TutorRequest["selection"],
) {
  const tooSmall =
    selection.width <= 8 ||
    selection.height <= 8 ||
    selection.width * selection.height < 100;
  return {
    ...analysis,
    confidence: tooSmall ? Math.min(analysis.confidence, 0.49) : analysis.confidence,
    needsConfirmation: analysis.needsConfirmation || tooSmall,
  };
}
