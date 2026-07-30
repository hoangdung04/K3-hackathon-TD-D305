export type Stage =
  | "draw"
  | "analyzing"
  | "confirm"
  | "uncertain"
  | "answer"
  | "error";

export type Scenario = "normal" | "hard";
export type AnnotationTool = "read" | "pen" | "highlight";

export type SelectionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TutorAnalysis = {
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

export const DEFAULT_QUESTION = "Giải thích phần tôi vừa khoanh";

export const PEN_COLORS = [
  { name: "Đỏ", value: "#dc2626", className: "red" },
  { name: "Xanh dương", value: "#2563eb", className: "blue" },
  { name: "Xanh lá", value: "#16a34a", className: "green" },
  { name: "Vàng", value: "#ca8a04", className: "yellow" },
  { name: "Cam", value: "#f59e0b", className: "orange" },
  { name: "Đen", value: "#111827", className: "black" },
] as const;

export type CourseSlide = {
  page: number;
  image: string;
};

export const COURSE_SLIDES: CourseSlide[] = Array.from({ length: 10 }, (_, index) => ({
  page: index + 1,
  image: `/slides/khoa-1/vlearn-day1-page-${String(index + 1).padStart(2, "0")}.png`,
}));
