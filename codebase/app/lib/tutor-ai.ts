export type TutorRequest = {
  image: string;
  selectionImage?: string;
  page: number;
  question: string;
  selection: { x: number; y: number; width: number; height: number };
  queryScope: "region" | "lesson";
};

export const tutorAnalysisSchema = {
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
} as const;

export function buildTutorPrompt(input: TutorRequest) {
  const isLessonQuestion = input.queryScope === "lesson";
  return [
    "Bạn là Entropy, trợ giảng tiếng Việt giải thích bài học từ slide.",
    isLessonQuestion
      ? "Đây là câu hỏi về toàn bộ slide/bài học, không có vùng khoanh riêng. Dùng toàn bộ slide làm ngữ cảnh, trả lời trực tiếp câu hỏi. regionTitle phải là 'Toàn bộ slide'; không được yêu cầu khoanh lại chỉ vì không có nét bút."
      : "Ảnh đầu là toàn bộ slide và nét bút đỏ. Nếu có ảnh thứ hai, đó là ảnh cắt quanh vùng khoanh; ưu tiên ảnh cắt để xác định phần học viên vừa chọn, nhưng luôn dùng toàn bộ slide để hiểu câu hỏi.",
    JSON.stringify(input.selection),
    `Trang: ${input.page}. Câu hỏi: ${input.question}`,
    "Khi có vùng khoanh, hãy xác định nội dung nằm trong hoặc sát nét khoanh; không suy diễn nội dung không thấy trên ảnh khi mô tả vùng hoặc nêu evidence.",
    "Người học được hỏi tiếp kiến thức liên quan đến vùng khoanh, toàn bộ slide hoặc bài học (định nghĩa, ví dụ, so sánh, ứng dụng). Luôn trả lời trực tiếp ý nghĩa của câu hỏi trước; vùng khoanh chỉ là ngữ cảnh gợi ý, không phải giới hạn chủ đề. Ví dụ nếu khoanh 'Foundation' nhưng hỏi 'AI là gì?', hãy giải thích AI dựa trên tiêu đề slide và nói rõ liên hệ với nền tảng AI & LLM.",
    "Chỉ yêu cầu khoanh lại khi câu hỏi thực sự cần đọc một chi tiết trên ảnh mà không xác định được; không yêu cầu khoanh lại chỉ vì người học hỏi kiến thức rộng hơn.",
    !isLessonQuestion && "Nếu vùng chạm nhiều khối nội dung, hoặc đồng thời có tiêu đề và đoạn mô tả, hoặc quá nhỏ/mơ hồ: bắt buộc needsConfirmation=true và confidence dưới 0.7.",
    !isLessonQuestion && "Nếu trong vùng không có nội dung đọc được, chỉ có nền trống, nét kẻ linh tinh hoặc dấu chấm: bắt buộc requiresRedraw=true, needsConfirmation=true, confidence không quá 0.49. confirmationQuestion phải yêu cầu: 'Mình chưa thấy nội dung trong vùng này. Bạn hãy khoanh lại trọn phần chữ/hình cần hỏi nhé.' Không được trả lời hoặc cho phép dùng vùng này.",
    !isLessonQuestion && "Với vùng chỉ có 1-2 từ, hãy kiểm tra trước xem đó có phải keyword/thuật ngữ/nhãn có nghĩa độc lập hay không (ví dụ: Zero-shot). Chỉ khi đúng mới giải thích bình thường.",
    !isLessonQuestion && "Nếu vùng chỉ là chữ cái, mảnh cụm, đại từ, động từ hoặc từ nối chưa đủ ý: không giải thích, không đoán ý định và không gợi ý thêm nội dung. Bắt buộc đặt needsConfirmation=true, requiresRedraw=true và confidence không quá 0.49.",
    !isLessonQuestion && "Trong trường hợp chữ/cụm chưa rõ, hãy đọc chữ liền kề nhìn thấy trên cùng dòng/đoạn và confirmationQuestion chỉ được nêu theo mẫu: 'Bạn đang khoanh “…” trong câu “…”.' regionDescription cũng chỉ xác định chữ/cụm đang khoanh và câu chứa nó. Chỉ dùng chữ thực sự nhìn thấy trên slide, không tự bịa phần còn thiếu.",
    "confirmationQuestion hỏi lại ngắn gọn. answer giải thích đúng trọng tâm bằng tiếng Việt, 2-4 câu.",
    "evidence mô tả ngắn phần chữ nhìn thấy trên slide. Không bịa nguồn bên ngoài.",
  ].filter(Boolean).join("\n");
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
        ...(input.selectionImage
          ? [{ type: "input_image" as const, image_url: input.selectionImage, detail: "high" as const }]
          : []),
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
    typeof value.needsConfirmation !== "boolean" ||
    typeof value.requiresRedraw !== "boolean"
  ) {
    throw new Error("AI trả về dữ liệu không đúng cấu trúc.");
  }
  const analysis = value as {
    regionTitle: string;
    regionDescription: string;
    confidence: number;
    needsConfirmation: boolean;
    requiresRedraw: boolean;
    confirmationQuestion: string;
    answerTitle: string;
    answer: string;
    evidence: string;
  };
  return {
    ...analysis,
    needsConfirmation:
      analysis.needsConfirmation || analysis.confidence < 0.7 || analysis.requiresRedraw,
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
    requiresRedraw: analysis.requiresRedraw || tooSmall,
  };
}
