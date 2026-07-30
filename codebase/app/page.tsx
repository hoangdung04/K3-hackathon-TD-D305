"use client";
/* eslint-disable @next/next/no-img-element -- canvas capture requires the native loaded image element. */

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { RegionPreview } from "./components/region-preview";
import {
  type AnnotationTool,
  type Scenario,
  type SelectionBox,
  type Stage,
  type TutorAnalysis,
  COURSE_SLIDES,
  DEFAULT_QUESTION,
  PEN_COLORS,
} from "./lib/tutor-ui";

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const slideImageRef = useRef<HTMLImageElement>(null);
  const drawingRef = useRef(false);
  const drawingHistoryRef = useRef<ImageData[]>([]);
  const strokeStartRef = useRef<{ x: number; y: number } | null>(null);
  const strokePreviousRef = useRef<{ x: number; y: number } | null>(null);
  const strokeLengthRef = useRef(0);
  const requestAbortRef = useRef<AbortController | null>(null);
  const drawPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const boundsRef = useRef({
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: 0,
    maxY: 0,
  });

  const [stage, setStage] = useState<Stage>("draw");
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [annotationTool, setAnnotationTool] = useState<AnnotationTool>("pen");
  const [penColor, setPenColor] = useState<(typeof PEN_COLORS)[number]["value"]>("#dc2626");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [zoom, setZoom] = useState(1);
  const [canUndo, setCanUndo] = useState(false);
  const [question, setQuestion] = useState(DEFAULT_QUESTION);
  const [submittedQuestion, setSubmittedQuestion] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionBox | null>(null);
  const [followUpContext, setFollowUpContext] = useState<{
    selection: SelectionBox;
    image: string;
    selectionImage: string;
    page: number;
  } | null>(null);
  const [analysis, setAnalysis] = useState<TutorAnalysis | null>(null);
  const [error, setError] = useState("");
  const [quotaUsed, setQuotaUsed] = useState(0);
  const [history, setHistory] = useState<Array<{
    id: string;
    question: string;
    regionTitle: string;
    answerTitle: string;
    createdAt: number;
  }>>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [completedTurns, setCompletedTurns] = useState<Array<{
    id: string;
    question: string;
    analysis: TutorAnalysis;
    page: number;
  }>>([]);
  const [feedbackByTurn, setFeedbackByTurn] = useState<Record<string, "up" | "down">>({});
  const [notice, setNotice] = useState("");
  const [drawPromptActive, setDrawPromptActive] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedSelectionImage, setCapturedSelectionImage] = useState<string | null>(null);
  const currentSlide = COURSE_SLIDES[slideIndex];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = 4;
      context.strokeStyle = "#dc2626";
    };

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [zoom]);

  useEffect(() => () => {
    if (drawPromptTimerRef.current) clearTimeout(drawPromptTimerRef.current);
  }, []);

  const canvasPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const startDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (stage !== "draw" || annotationTool === "read") return;
    const point = canvasPoint(event);
    const context = event.currentTarget.getContext("2d");
    if (!context) return;

    event.preventDefault();
    if (drawPromptTimerRef.current) clearTimeout(drawPromptTimerRef.current);
    setDrawPromptActive(false);
    setSelection(null);
    setFollowUpContext(null);
    setAnalysis(null);
    setSubmittedQuestion(null);
    setCapturedImage(null);
    setCapturedSelectionImage(null);
    setError("");
    setStage("draw");
    drawingHistoryRef.current.push(
      context.getImageData(0, 0, event.currentTarget.width, event.currentTarget.height),
    );
    setCanUndo(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    strokeStartRef.current = { x: point.x, y: point.y };
    strokePreviousRef.current = { x: point.x, y: point.y };
    strokeLengthRef.current = 0;
    boundsRef.current = {
      minX: point.x,
      minY: point.y,
      maxX: point.x,
      maxY: point.y,
    };
    context.beginPath();
    context.globalAlpha = annotationTool === "highlight" ? 0.34 : 1;
    context.lineWidth = annotationTool === "highlight"
      ? Math.max(14, strokeWidth * 4)
      : strokeWidth;
    context.strokeStyle = penColor;
    context.moveTo(point.x, point.y);
  };

  const draw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || stage !== "draw" || annotationTool === "read") return;
    const point = canvasPoint(event);
    const context = event.currentTarget.getContext("2d");
    if (!context) return;

    context.lineTo(point.x, point.y);
    context.stroke();
    const previous = strokePreviousRef.current;
    if (previous) {
      strokeLengthRef.current += Math.hypot(point.x - previous.x, point.y - previous.y);
    }
    strokePreviousRef.current = { x: point.x, y: point.y };
    boundsRef.current = {
      minX: Math.min(boundsRef.current.minX, point.x),
      minY: Math.min(boundsRef.current.minY, point.y),
      maxX: Math.max(boundsRef.current.maxX, point.x),
      maxY: Math.max(boundsRef.current.maxY, point.y),
    };
  };

  const finishDrawingAt = (
    canvas: HTMLCanvasElement,
    pointerId: number,
    clientX: number,
    clientY: number,
  ) => {
    if (!drawingRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const point = {
      x: clientX - rect.left,
      y: clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
    const context = canvas.getContext("2d");
    const previous = strokePreviousRef.current;
    if (previous) {
      strokeLengthRef.current += Math.hypot(point.x - previous.x, point.y - previous.y);
    }
    context?.lineTo(point.x, point.y);
    context?.stroke();
    drawingRef.current = false;
    if (canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
    const bounds = boundsRef.current;
    const padding = 12;
    const left = Math.max(0, bounds.minX - padding);
    const top = Math.max(0, bounds.minY - padding);
    const right = Math.min(point.width, Math.max(bounds.maxX, point.x) + padding);
    const bottom = Math.min(point.height, Math.max(bounds.maxY, point.y) + padding);
    const start = strokeStartRef.current;
    const closesLoop = Boolean(
      start && Math.hypot(point.x - start.x, point.y - start.y) <= Math.max(20, strokeLengthRef.current * 0.1),
    );
    const coveredArea = (right - left) * (bottom - top);
    if (!closesLoop || strokeLengthRef.current < 70 || coveredArea < 900) {
      const beforeStroke = drawingHistoryRef.current.pop();
      if (beforeStroke) context?.putImageData(beforeStroke, 0, 0);
      setCanUndo(drawingHistoryRef.current.length > 0);
      setSelection(null);
      setNotice("Chưa tạo được vùng khoanh hợp lệ. Hãy khoanh trọn phần chữ hoặc hình cần hỏi.");
      return;
    }

    setSelection({
      x: (left / point.width) * 100,
      y: (top / point.height) * 100,
      width: Math.max(8, ((right - left) / point.width) * 100),
      height: Math.max(8, ((bottom - top) / point.height) * 100),
    });
  };

  const finishDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    finishDrawingAt(
      event.currentTarget,
      event.pointerId,
      event.clientX,
      event.clientY,
    );
  };

  useEffect(() => {
    const endDetachedStroke = (event: PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas || !drawingRef.current) return;
      finishDrawingAt(canvas, event.pointerId, event.clientX, event.clientY);
    };
    window.addEventListener("pointerup", endDetachedStroke);
    window.addEventListener("pointercancel", endDetachedStroke);
    return () => {
      window.removeEventListener("pointerup", endDetachedStroke);
      window.removeEventListener("pointercancel", endDetachedStroke);
    };
  });

  const clearDrawing = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext("2d");
      context?.clearRect(0, 0, canvas.width, canvas.height);
    }
    drawingHistoryRef.current = [];
    setCanUndo(false);
    setSelection(null);
    setFollowUpContext(null);
    setAnalysis(null);
    setSubmittedQuestion(null);
    setCapturedImage(null);
    setCapturedSelectionImage(null);
    setError("");
    setStage("draw");
  };

  const undoDrawing = () => {
    const canvas = canvasRef.current;
    const previous = drawingHistoryRef.current.pop();
    if (!canvas || !previous) return;
    canvas.getContext("2d")?.putImageData(previous, 0, 0);
    setCanUndo(drawingHistoryRef.current.length > 0);
    setSelection(null);
    setAnalysis(null);
    setSubmittedQuestion(null);
    setCapturedImage(null);
    setCapturedSelectionImage(null);
    setStage("draw");
  };

  const downloadAnnotation = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `vlearn-annotation-page-${currentSlide.page}.png`;
    link.click();
    setNotice("Đã tải ảnh nét khoanh xuống máy.");
  };

  const changeSlide = (nextIndex: number) => {
    if (stage === "analyzing" || nextIndex < 0 || nextIndex >= COURSE_SLIDES.length) return;
    clearDrawing();
    setSlideIndex(nextIndex);
    requestAnimationFrame(() => {
      slideRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };

  const sessionHeaders = () => {
    let session = window.localStorage.getItem("vlearn-session");
    if (!session) {
      session = crypto.randomUUID();
      window.localStorage.setItem("vlearn-session", session);
    }
    return { "x-vlearn-session": session };
  };

  const makeSlideImage = async (selected: SelectionBox) => {
    const slide = slideRef.current;
    const slideImage = slideImageRef.current;
    const ink = canvasRef.current;
    if (!slide || !slideImage) throw new Error("Không thể đọc nội dung slide.");
    if (!ink) throw new Error("Không thể đọc lớp annotation.");
    if (!slideImage.complete || !slideImage.naturalWidth) {
      await slideImage.decode();
    }
    const output = document.createElement("canvas");
    output.width = 1280;
    output.height = 720;
    const context = output.getContext("2d");
    if (!context) throw new Error("Trình duyệt không hỗ trợ canvas.");

    context.drawImage(slideImage, 0, 0, output.width, output.height);
    context.drawImage(ink, 0, 0, output.width, output.height);
    const padding = 110;
    const sourceX = Math.max(0, (selected.x / 100) * output.width - padding);
    const sourceY = Math.max(0, (selected.y / 100) * output.height - padding);
    const sourceRight = Math.min(
      output.width,
      ((selected.x + selected.width) / 100) * output.width + padding,
    );
    const sourceBottom = Math.min(
      output.height,
      ((selected.y + selected.height) / 100) * output.height + padding,
    );
    const crop = document.createElement("canvas");
    crop.width = Math.max(1, Math.round(sourceRight - sourceX));
    crop.height = Math.max(1, Math.round(sourceBottom - sourceY));
    crop.getContext("2d")?.drawImage(
      output,
      sourceX,
      sourceY,
      sourceRight - sourceX,
      sourceBottom - sourceY,
      0,
      0,
      crop.width,
      crop.height,
    );
    return {
      image: output.toDataURL("image/jpeg", 0.88),
      selectionImage: crop.toDataURL("image/jpeg", 0.92),
    };
  };

  const loadHistory = async () => {
    setHistoryError("");
    setIsHistoryLoading(true);
    try {
      const response = await fetch("/api/history", { headers: sessionHeaders() });
      if (!response.ok) throw new Error("Chưa thể tải lịch sử lúc này.");
      const payload = (await response.json()) as { items: typeof history };
      setHistory(payload.items);
      setShowHistory(true);
    } catch (cause) {
      setHistoryError(cause instanceof Error ? cause.message : "Chưa thể tải lịch sử lúc này.");
      setShowHistory(true);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const submitQuestion = async () => {
    const activeContext = selection
      ? null
      : followUpContext;
    const activeSelection = selection || activeContext?.selection;
    if (!activeSelection || !question.trim()) return;
    const nextQuestion = question.trim();
    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;
    setStage("analyzing");
    setSubmittedQuestion(nextQuestion);
    setError("");
    try {
      const capture = selection
        ? await makeSlideImage(activeSelection)
        : activeContext && {
          image: activeContext.image,
          selectionImage: activeContext.selectionImage,
        };
      if (!capture) throw new Error("Không thể đọc ảnh của vùng vừa hỏi.");
      setCapturedImage(capture.image);
      setCapturedSelectionImage(capture.selectionImage);
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json", ...sessionHeaders() },
        signal: controller.signal,
        body: JSON.stringify({
          image: capture.image,
          selectionImage: capture.selectionImage,
          page: activeContext?.page || currentSlide.page,
          question: nextQuestion,
          selection: activeSelection,
        }),
      });
      const responseText = await response.text();
      let payload: (
        | { analysis: TutorAnalysis; quota?: { used: number; limit: number } }
        | { error: string }
      );
      try {
        payload = JSON.parse(responseText) as typeof payload;
      } catch {
        throw new Error("Máy chủ trả về phản hồi không hợp lệ. Hãy thử lại.");
      }
      if (!response.ok || !("analysis" in payload)) {
        throw new Error(
          "error" in payload ? payload.error : "Không thể phân tích vùng khoanh.",
        );
      }
      setAnalysis(payload.analysis);
      if (payload.quota) setQuotaUsed(payload.quota.used);
      setStage(payload.analysis.needsConfirmation ? "uncertain" : "confirm");
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(
        cause instanceof Error ? cause.message : "Đã có lỗi không xác định.",
      );
      setStage("error");
    } finally {
      if (requestAbortRef.current === controller) requestAbortRef.current = null;
    }
  };

  const resetConversation = () => {
    requestAbortRef.current?.abort();
    setQuestion(DEFAULT_QUESTION);
    setSubmittedQuestion(null);
    clearDrawing();
    setCompletedTurns([]);
    setFeedbackByTurn({});
    setShowHistory(false);
    setNotice("");
  };

  const changeScenario = (nextScenario: Scenario) => {
    setScenario(nextScenario);
    setQuestion(nextScenario === "hard"
      ? "Vùng này gồm những phần nào? Nếu chưa rõ hãy yêu cầu tôi khoanh lại."
      : DEFAULT_QUESTION);
    clearDrawing();
    setNotice(nextScenario === "hard"
      ? "Case khó: thử khoanh vùng nhỏ hoặc chạm nhiều khối để kiểm tra fallback."
      : "Case chuẩn: khoanh trọn một tiêu đề hoặc đoạn văn.");
  };

  const recordFeedback = (turnId: string, value: "up" | "down") => {
    setFeedbackByTurn((current) => ({ ...current, [turnId]: value }));
    setNotice(value === "up" ? "Đã ghi nhận: câu trả lời hữu ích." : "Đã ghi nhận: cần cải thiện câu trả lời này.");
  };

  const prepareNextQuestion = () => {
    requestAbortRef.current?.abort();
    setAnnotationTool("pen");
    setQuestion(DEFAULT_QUESTION);
    setSubmittedQuestion(null);
    clearDrawing();
    setNotice("Bút đã sẵn sàng — khoanh vùng mới rồi đặt câu hỏi tiếp.");
    if (drawPromptTimerRef.current) clearTimeout(drawPromptTimerRef.current);
    setDrawPromptActive(false);
    requestAnimationFrame(() => {
      setDrawPromptActive(true);
      drawPromptTimerRef.current = setTimeout(() => {
        setDrawPromptActive(false);
        drawPromptTimerRef.current = null;
      }, 2200);
    });
  };

  const askRelatedKnowledge = (regionTitle: string) => {
    if (!followUpContext) return;
    setQuestion(`Kiến thức liên quan đến “${regionTitle}” là gì?`);
    setNotice("Bạn có thể hỏi thêm định nghĩa, ví dụ hoặc so sánh về phần vừa khoanh.");
    requestAnimationFrame(() => composerRef.current?.focus());
  };

  const completeAnswer = () => {
    if (!analysis || !submittedQuestion) return;
    const nextFollowUpContext = selection && capturedImage && capturedSelectionImage
      ? {
        selection,
        image: capturedImage,
        selectionImage: capturedSelectionImage,
        page: currentSlide.page,
      }
      : followUpContext;
    setCompletedTurns((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        question: submittedQuestion,
        analysis,
        page: currentSlide.page,
      },
    ]);
    prepareNextQuestion();
    setFollowUpContext(nextFollowUpContext);
  };

  return (
    <main className="appShell">
      <header className="topbar">
        <div className="topbarLeft">
          <button className="iconButton backButton" aria-label="Quay lại" onClick={() => window.history.back()}>
            ‹
          </button>
          <div className="brandMark" aria-hidden="true">
            V
          </div>
          <div className="brandName">VLearn</div>
          <div className="documentIdentity">
            <span className="bookIcon" aria-hidden="true">
              ▣
            </span>
            <div>
              <h1>d1-slide-hackathon.pdf</h1>
              <p>AI & LLM Foundation · Bài giảng Khoá 1</p>
            </div>
          </div>
        </div>
        <div className="topbarActions">
          <span className="localeButton" title="Giao diện tiếng Việt">VI</span>
          <div className="userPill">♙&nbsp; Sinh viên ẩn danh</div>
        </div>
      </header>

      <section className="workspace">
        <div className="readerPane">
          <div className="readerToolbar" aria-label="Thanh công cụ đọc">
            <div className="toolGroup">
              <button className={`toolButton ${annotationTool === "read" ? "active" : ""}`} onClick={() => setAnnotationTool("read")} aria-pressed={annotationTool === "read"}>⌁ Đọc</button>
              <button className={`toolButton ${annotationTool === "pen" ? "active" : ""}`} onClick={() => setAnnotationTool("pen")} aria-pressed={annotationTool === "pen"}>✎ Bút</button>
              <button className={`toolButton ${annotationTool === "highlight" ? "active" : ""}`} onClick={() => setAnnotationTool("highlight")} aria-pressed={annotationTool === "highlight"}>⌁ Highlight</button>
            </div>
            <div className="pageNote">Trang {currentSlide.page} · 1 note</div>
            <div className="zoomGroup">
              <button onClick={() => setZoom((value) => Math.max(0.8, Number((value - 0.1).toFixed(1))))} disabled={zoom <= 0.8} aria-label="Thu nhỏ">−</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((value) => Math.min(1.3, Number((value + 0.1).toFixed(1))))} disabled={zoom >= 1.3} aria-label="Phóng to">＋</button>
            </div>
            <div className="utilityGroup">
              <button aria-label="Đặt câu hỏi" onClick={() => composerRef.current?.focus()}>＋</button>
              <button aria-label="Tải nét khoanh" onClick={downloadAnnotation}>⇩</button>
              <button aria-label="Hoàn tác nét cuối" onClick={undoDrawing} disabled={!canUndo}>↶</button>
              <button aria-label="Xóa nét" onClick={clearDrawing}>
                ♲
              </button>
            </div>
          </div>

          <div className="penToolbar">
            <div className="colorSwatches" aria-label="Màu nét">
              {PEN_COLORS.map((color) => (
                <button key={color.value} type="button" className={`swatch ${color.className} ${penColor === color.value ? "active" : ""}`} onClick={() => setPenColor(color.value)} aria-label={`Chọn màu ${color.name}`} aria-pressed={penColor === color.value} />
              ))}
            </div>
            <label className="strokeControl">
              <span className="strokeLabel">NÉT</span>
              <input
                className="strokeRange"
                type="range"
                min="2"
                max="12"
                step="1"
                value={strokeWidth}
                onChange={(event) => setStrokeWidth(Number(event.target.value))}
                aria-label="Độ dày nét bút"
                aria-valuetext={`${strokeWidth} pixel`}
              />
              <output className="strokeValue">{strokeWidth}px</output>
            </label>
          </div>

          <div className="slidesViewport">
            <div className="sideTab">▹</div>
            <div className="slideTestPicker" aria-label="Bộ slide kiểm thử">
              <span>10 TRANG BÀI GIẢNG KHOÁ 1</span>
              <div>
                {COURSE_SLIDES.map((slide, index) => (
                  <button
                    key={slide.page}
                    className={`slideThumb ${index === slideIndex ? "active" : ""}`}
                    onClick={() => changeSlide(index)}
                    aria-label={`Mở trang ${slide.page} của bài giảng Khoá 1`}
                  >
                    <img src={slide.image} alt="" aria-hidden="true" draggable={false} />
                    <span className="slideThumbCaption">Trang {slide.page}</span>
                  </button>
                ))}
              </div>
            </div>
            <article className="slideSheet currentSlide" style={{ "--slide-zoom": zoom } as CSSProperties}>
              <div className="slideMeta">
                <span>Trang {currentSlide.page} / {COURSE_SLIDES.length}</span>
                <span>d1-slide-hackathon.pdf · Bài giảng Khoá 1</span>
              </div>
              <div className={`slideCanvas ${drawPromptActive ? "readyToDraw" : ""}`} ref={slideRef}>
                <img
                  ref={slideImageRef}
                  className="slideImage"
                  src={currentSlide.image}
                  alt={`Trang ${currentSlide.page} của bài giảng AI & LLM Foundation Khoá 1`}
                  draggable={false}
                />
                <canvas
                  ref={canvasRef}
                  className="annotationCanvas"
                  aria-label={`Khoanh vùng trên trang ${currentSlide.page}`}
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={finishDrawing}
                  onPointerCancel={finishDrawing}
                  aria-disabled={annotationTool === "read"}
                />
                {drawPromptActive ? (
                  <div className="drawAgainPrompt" role="status">
                    ✎ Khoanh vùng mới ngay tại đây
                  </div>
                ) : null}
                {selection ? (
                  <div
                    className={`detectedBox ${stage === "draw" ? "selectionReady" : ""}`}
                    style={{
                      left: `${selection.x}%`,
                      top: `${selection.y}%`,
                      width: `${selection.width}%`,
                      height: `${selection.height}%`,
                    }}
                  >
                    <span>{stage === "draw" ? "Đã chọn vùng — nhập câu hỏi để gửi" : "Vùng AI nhận được"}</span>
                  </div>
                ) : null}
              </div>
              <p className="noteHint">
                Kéo đến trang này để mở note riêng của trang.
              </p>
            </article>
          </div>

          <div className="pageNavigation">
            <button onClick={() => changeSlide(slideIndex - 1)} disabled={slideIndex === 0 || stage === "analyzing"}>‹</button>
            <span>Trang {currentSlide.page} / {COURSE_SLIDES.length}</span>
            <button onClick={() => changeSlide(slideIndex + 1)} disabled={slideIndex === COURSE_SLIDES.length - 1 || stage === "analyzing"}>›</button>
          </div>
        </div>

        <aside className="tutorPane" aria-label="VLearn Tutor">
          <div className="tutorHeader">
            <div>
              <h2>VLearn Tutor</h2>
              <p>Trợ lý học theo ngữ cảnh</p>
            </div>
            <div className="tutorHeaderActions">
              <button aria-label="Lịch sử" onClick={loadHistory} disabled={isHistoryLoading}>{isHistoryLoading ? "…" : "↶"}</button>
              <button aria-label="Cuộc trò chuyện mới" onClick={resetConversation}>
                ＋
              </button>
              <span className="slideContextPill">Trang slide: {currentSlide.page}</span>
            </div>
          </div>

          <div className="quotaRow">
            <span>Quota Tutor trong ngày</span>
            <span>{quotaUsed} / 15 câu</span>
            <span className="byokPill">⚿ BYOK</span>
          </div>
          <div className="quotaTrack">
            <span style={{ width: `${Math.max(1, (quotaUsed / 15) * 100)}%` }} />
          </div>

          <div className="demoControls">
            <span>Chế độ demo</span>
            <div className="scenarioToggle">
              <button
                className={scenario === "normal" ? "active" : ""}
                onClick={() => changeScenario("normal")}
              >
                Case chuẩn
              </button>
              <button
                className={scenario === "hard" ? "active" : ""}
                onClick={() => changeScenario("hard")}
              >
                Case khó
              </button>
            </div>
          </div>

          <div className="contextBanner">
            <span className="statusDot" />
            <div>
              <strong>Ngữ cảnh đã đồng bộ</strong>
              <small>Slide trang {currentSlide.page} · {annotationTool === "read" ? "Đang ở chế độ đọc" : "Sẵn sàng khoanh vùng"}</small>
            </div>
          </div>

          <div className="conversation">
            <div className="assistantMessage onboardingHint">
              Xin chào! Khoanh vùng trên slide, sau đó hỏi mình về đúng phần
              bạn chưa hiểu nhé.
            </div>

            {completedTurns.map((turn, index) => (
              <div className="completedTurn" key={turn.id}>
                <div className="studentMessage">{turn.question}</div>
                <div className="assistantMessage responseCard answerCard">
                  <span className="confidenceLabel">GIẢI THÍCH THEO SLIDE {turn.page}</span>
                  <strong>{turn.analysis.answerTitle}</strong>
                  <p>{turn.analysis.answer}</p>
                  <div className="citation">Nguồn: Trang {turn.page} · {turn.analysis.evidence}</div>
                  <div className="answerFeedback">
                    <span>Câu trả lời này có hữu ích không?</span>
                    <button className={feedbackByTurn[turn.id] === "up" ? "feedbackActive" : ""} onClick={() => recordFeedback(turn.id, "up")} aria-pressed={feedbackByTurn[turn.id] === "up"}>👍</button>
                    <button className={feedbackByTurn[turn.id] === "down" ? "feedbackActive" : ""} onClick={() => recordFeedback(turn.id, "down")} aria-pressed={feedbackByTurn[turn.id] === "down"}>👎</button>
                  </div>
                  <div className="responseActions">
                    {index === completedTurns.length - 1 && followUpContext ? (
                      <button className="secondaryAction" onClick={() => askRelatedKnowledge(turn.analysis.regionTitle)}>
                        Hỏi kiến thức liên quan
                      </button>
                    ) : null}
                    <button className="primaryAction" onClick={prepareNextQuestion}>
                      Khoanh vùng mới để hỏi tiếp
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {showHistory ? (
              <div className="historyPanel">
                <div className="historyTitle">
                  <strong>Lịch sử gần đây</strong>
                  <button onClick={() => setShowHistory(false)} aria-label="Đóng lịch sử">×</button>
                </div>
                {historyError ? <p>{historyError}</p> : history.length ? history.map((item) => (
                  <article key={item.id}>
                    <span>{new Date(item.createdAt).toLocaleString("vi-VN")}</span>
                    <strong>{item.regionTitle}</strong>
                    <p>{item.question}</p>
                  </article>
                )) : <p>Chưa có câu hỏi nào được lưu.</p>}
              </div>
            ) : null}

            {submittedQuestion ? (
              <div className="studentMessage">{submittedQuestion}</div>
            ) : null}

            {stage === "analyzing" ? (
              <div className="assistantMessage responseCard loadingCard">
                <span className="visionSpinner" aria-hidden="true" />
                <strong>Entropy đang đọc vùng bạn khoanh…</strong>
                <p>Đang đối chiếu nét bút, nội dung slide và câu hỏi.</p>
              </div>
            ) : null}

            {stage === "confirm" && analysis ? (
              <div className="assistantMessage responseCard">
                <span className="confidenceLabel">
                  ĐÃ NHẬN VÙNG · {Math.round(analysis.confidence * 100)}%
                </span>
                <strong>{analysis.confirmationQuestion}</strong>
                <p>{analysis.regionDescription}</p>
                <RegionPreview
                  selection={selection}
                  title={analysis.regionTitle}
                  image={capturedImage}
                  page={currentSlide.page}
                />
                <div className="responseActions">
                  <button className="primaryAction" onClick={completeAnswer}>
                    Đúng, giải thích
                  </button>
                  <button className="secondaryAction" onClick={clearDrawing}>
                    Khoanh lại
                  </button>
                </div>
              </div>
            ) : null}

            {stage === "uncertain" && analysis ? (
              <div className="assistantMessage responseCard warningCard">
                <span className="confidenceLabel warning">
                  CHƯA CHẮC · {Math.round(analysis.confidence * 100)}%
                </span>
                <strong>{analysis.confirmationQuestion}</strong>
                <p>{analysis.regionDescription}</p>
                <RegionPreview
                  selection={selection}
                  title={analysis.regionTitle}
                  image={capturedImage}
                  page={currentSlide.page}
                />
                <div className="responseActions">
                  <button className="primaryAction" onClick={clearDrawing}>
                    Khoanh lại
                  </button>
                  {!analysis.requiresRedraw ? (
                    <button className="secondaryAction" onClick={completeAnswer}>
                      Vẫn dùng vùng này
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {stage === "error" ? (
              <div className="assistantMessage responseCard errorCard">
                <span className="confidenceLabel warning">CHƯA THỂ PHÂN TÍCH</span>
                <strong>{error}</strong>
                <p>
                  Bạn cần khoanh vùng chính xác; vùng bạn khoanh chưa đủ dữ liệu.
                </p>
                <div className="responseActions">
                  <button className="primaryAction" onClick={submitQuestion}>Thử lại</button>
                  <button className="secondaryAction" onClick={clearDrawing}>Khoanh lại</button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="composer">
            <textarea
              ref={composerRef}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Nhập câu hỏi hoặc khoanh trên slide..."
              aria-label="Câu hỏi cho VLearn Tutor"
              rows={2}
            />
            <button
              className="sendButton"
              aria-label="Gửi câu hỏi"
              disabled={
                (!selection && !followUpContext) ||
                !question.trim() ||
                !["draw", "error"].includes(stage)
              }
              onClick={submitQuestion}
            >
              ➤
            </button>
            <div className="composerHint">
              {selection
                ? `Đã nhận vùng khoanh trên trang ${currentSlide.page}`
                : followUpContext
                  ? "Hỏi tiếp về vùng trước, kiến thức liên quan, hoặc khoanh vùng mới"
                : "Dùng bút khoanh một vùng để bắt đầu"}
            </div>
            {notice ? <div className="composerNotice" role="status">{notice}</div> : null}
          </div>
        </aside>
      </section>
    </main>
  );
}
