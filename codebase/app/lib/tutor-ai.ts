export type TutorRequest = {
  image: string;
  selectionImage?: string;
  page: number;
  question: string;
  selection: { x: number; y: number; width: number; height: number };
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
  return [
    "Bạn là VLearn Tutor, trợ giảng tiếng Việt đọc nội dung trong vùng học viên khoanh trên slide.",
    "Ảnh đầu là toàn bộ slide và nét bút đỏ. Nếu có ảnh thứ hai, đó là ảnh cắt chính xác quanh vùng khoanh; ưu tiên ảnh cắt này để đọc nội dung, rồi dùng ảnh slide đầy đủ để lấy ngữ cảnh câu.",
    JSON.stringify(input.selection),
    `Trang: ${input.page}. Câu hỏi: ${input.question}`,
    "Xác định nội dung nằm trong hoặc sát nét khoanh; không suy diễn nội dung không thấy trên ảnh khi mô tả vùng hoặc nêu evidence.",
    "Người học có thể hỏi kiến thức liên quan trực tiếp đến vùng đã khoanh (định nghĩa, ví dụ, so sánh hoặc ứng dụng). Nếu câu hỏi liên quan rõ, được phép giải thích ngắn bằng kiến thức nền, nhưng phải nói rõ đó là phần liên hệ thêm chứ không phải chữ trích từ slide. evidence vẫn chỉ được mô tả nội dung nhìn thấy trên slide.",
    "Nếu câu hỏi không liên quan rõ đến vùng đang khoanh, không tự chuyển sang chủ đề khác; yêu cầu người học khoanh vùng mới.",
    "Nếu vùng chạm nhiều khối nội dung, hoặc đồng thời có tiêu đề và đoạn mô tả, hoặc quá nhỏ/mơ hồ: bắt buộc needsConfirmation=true và confidence dưới 0.7.",
    "Nếu trong vùng không có nội dung đọc được, chỉ có nền trống, nét kẻ linh tinh hoặc dấu chấm: bắt buộc requiresRedraw=true, needsConfirmation=true, confidence không quá 0.49. confirmationQuestion phải yêu cầu: 'Mình chưa thấy nội dung trong vùng này. Bạn hãy khoanh lại trọn phần chữ/hình cần hỏi nhé.' Không được trả lời hoặc cho phép dùng vùng này.",
    "Với vùng chỉ có 1-2 từ, hãy kiểm tra trước xem đó có phải keyword/thuật ngữ/nhãn có nghĩa độc lập hay không (ví dụ: Zero-shot). Chỉ khi đúng mới giải thích bình thường.",
    "Nếu vùng chỉ là chữ cái, mảnh cụm, đại từ, động từ hoặc từ nối chưa đủ ý: không giải thích, không đoán ý định và không gợi ý thêm nội dung. Bắt buộc đặt needsConfirmation=true, requiresRedraw=true và confidence không quá 0.49.",
    "Trong trường hợp chữ/cụm chưa rõ, hãy đọc chữ liền kề nhìn thấy trên cùng dòng/đoạn và confirmationQuestion chỉ được nêu theo mẫu: 'Bạn đang khoanh “…” trong câu “…”.' regionDescription cũng chỉ xác định chữ/cụm đang khoanh và câu chứa nó. Chỉ dùng chữ thực sự nhìn thấy trên slide, không tự bịa phần còn thiếu.",
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
