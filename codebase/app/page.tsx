"use client";

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type Stage =
  | "draw"
  | "analyzing"
  | "confirm"
  | "uncertain"
  | "answer"
  | "error";
type Scenario = "normal" | "hard";
type AnnotationTool = "read" | "pen" | "highlight";

type SelectionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TutorAnalysis = {
  regionTitle: string;
  regionDescription: string;
  confidence: number;
  needsConfirmation: boolean;
  confirmationQuestion: string;
  answerTitle: string;
  answer: string;
  evidence: string;
};

const DEFAULT_QUESTION = "Giải thích phần tôi vừa khoanh";
const PEN_COLORS = [
  { name: "Đỏ", value: "#dc2626", className: "red" },
  { name: "Xanh dương", value: "#2563eb", className: "blue" },
  { name: "Xanh lá", value: "#16a34a", className: "green" },
  { name: "Vàng", value: "#ca8a04", className: "yellow" },
  { name: "Cam", value: "#f59e0b", className: "orange" },
  { name: "Đen", value: "#111827", className: "black" },
] as const;
const TEST_SLIDES = [
  {
    page: 10,
    section: "01",
    title: "Token Budget\nAwareness",
    description: "Phân bổ token hợp lý giữa chỉ dẫn, ngữ cảnh và phần trả lời.",
    accent: "blue",
    cards: ["Instructions · 25%", "Context · 50%", "Output · 25%"],
  },
  {
    page: 11,
    section: "02",
    title: "Advanced Prompting\nTechniques",
    description:
      "Dùng kỹ thuật nâng cao khi chúng cải thiện chất lượng thật sự, không dùng như thần chú.",
    accent: "navy",
    cards: ["Zero-shot", "Few-shot", "Chain of Thought"],
  },
  {
    page: 12,
    section: "03",
    title: "Prompting Methods",
    description: "So sánh bốn cách hướng dẫn mô hình theo số lượng ví dụ và mức suy luận.",
    accent: "coral",
    cards: ["Zero-shot", "One-shot", "Few-shot", "CoT"],
  },
  {
    page: 13,
    section: "04",
    title: "Tool Calling\nWorkflow",
    description: "Mô hình chọn công cụ, ứng dụng thực thi và kết quả được đưa lại vào ngữ cảnh.",
    accent: "green",
    cards: ["1 · User request", "2 · Tool call", "3 · Tool result", "4 · Final answer"],
  },
  {
    page: 14,
    section: "05",
    title: "Evaluation\nScorecard",
    description: "Đánh giá câu trả lời theo độ chính xác, căn cứ, tính rõ ràng và mức hữu ích.",
    accent: "purple",
    cards: ["Accuracy · 92", "Evidence · 86", "Clarity · 90", "Usefulness · 88"],
  },
] as const;

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef(false);
  const drawingHistoryRef = useRef<ImageData[]>([]);
  const requestAbortRef = useRef<AbortController | null>(null);
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
  const [zoom, setZoom] = useState(1);
  const [canUndo, setCanUndo] = useState(false);
  const [question, setQuestion] = useState(DEFAULT_QUESTION);
  const [selection, setSelection] = useState<SelectionBox | null>(null);
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
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [notice, setNotice] = useState("");
  const [slideIndex, setSlideIndex] = useState(1);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const currentSlide = TEST_SLIDES[slideIndex];

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

    drawingHistoryRef.current.push(
      context.getImageData(0, 0, event.currentTarget.width, event.currentTarget.height),
    );
    setCanUndo(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    boundsRef.current = {
      minX: point.x,
      minY: point.y,
      maxX: point.x,
      maxY: point.y,
    };
    context.beginPath();
    context.globalAlpha = annotationTool === "highlight" ? 0.34 : 1;
    context.lineWidth = annotationTool === "highlight" ? 18 : 4;
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
    boundsRef.current = {
      minX: Math.min(boundsRef.current.minX, point.x),
      minY: Math.min(boundsRef.current.minY, point.y),
      maxX: Math.max(boundsRef.current.maxX, point.x),
      maxY: Math.max(boundsRef.current.maxY, point.y),
    };
  };

  const finishDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const point = canvasPoint(event);
    const context = event.currentTarget.getContext("2d");
    context?.lineTo(point.x, point.y);
    context?.stroke();
    drawingRef.current = false;
    const bounds = boundsRef.current;
    const padding = 12;
    const left = Math.max(0, bounds.minX - padding);
    const top = Math.max(0, bounds.minY - padding);
    const right = Math.min(point.width, Math.max(bounds.maxX, point.x) + padding);
    const bottom = Math.min(point.height, Math.max(bounds.maxY, point.y) + padding);

    setSelection({
      x: (left / point.width) * 100,
      y: (top / point.height) * 100,
      width: Math.max(8, ((right - left) / point.width) * 100),
      height: Math.max(8, ((bottom - top) / point.height) * 100),
    });
  };

  const clearDrawing = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext("2d");
      context?.clearRect(0, 0, canvas.width, canvas.height);
    }
    drawingHistoryRef.current = [];
    setCanUndo(false);
    setSelection(null);
    setAnalysis(null);
    setCapturedImage(null);
    setError("");
    setFeedback(null);
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
    setCapturedImage(null);
    setFeedback(null);
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
    if (stage === "analyzing" || nextIndex < 0 || nextIndex >= TEST_SLIDES.length) return;
    clearDrawing();
    setSlideIndex(nextIndex);
  };

  const sessionHeaders = () => {
    let session = window.localStorage.getItem("vlearn-session");
    if (!session) {
      session = crypto.randomUUID();
      window.localStorage.setItem("vlearn-session", session);
    }
    return { "x-vlearn-session": session };
  };

  const makeSlideImage = async () => {
    const slide = slideRef.current;
    const ink = canvasRef.current;
    if (!slide) throw new Error("Không thể đọc nội dung slide.");
    if (!ink) throw new Error("Không thể đọc lớp annotation.");
    const output = document.createElement("canvas");
    output.width = 1280;
    output.height = 720;
    const context = output.getContext("2d");
    if (!context) throw new Error("Trình duyệt không hỗ trợ canvas.");

    const title =
      slide.querySelector<HTMLElement>(".slideCopy h2")?.innerText.trim() || "";
    const description =
      slide.querySelector<HTMLElement>(".slideCopy p")?.innerText.trim() || "";
    const section =
      slide.querySelector<HTMLElement>(".slideSectionLabel")?.innerText.trim() || "";

    context.fillStyle = "#315b94";
    context.fillRect(0, 0, output.width, output.height);
    context.fillStyle = "rgba(24, 53, 94, .45)";
    context.fillRect(755, 0, 525, output.height);
    context.fillStyle = "rgba(255, 255, 255, .07)";
    context.font = "900 320px Arial";
    context.fillText(section || "02", 830, 470);
    context.fillStyle = "rgba(255, 255, 255, .68)";
    context.font = "700 20px Arial";
    context.fillText(section || "02", 62, 76);
    context.fillStyle = "#fff";
    context.font = "700 58px Arial";
    title.split(/\r?\n/).forEach((line, index) => {
      context.fillText(line, 72, 278 + index * 66);
    });
    context.font = "26px Arial";
    wrapCanvasText(context, description, 72, 416, 660, 38);
    const visualLabels = [...slide.querySelectorAll<HTMLElement>(".visualCard")];
    visualLabels.forEach((card, index) => {
      const columns = visualLabels.length > 3 ? 2 : 1;
      const cardWidth = columns === 2 ? 190 : 390;
      const cardHeight = 76;
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = 805 + column * 205;
      const y = 190 + row * 92;
      context.fillStyle = "rgba(255,255,255,.16)";
      context.fillRect(x, y, cardWidth, cardHeight);
      context.fillStyle = "#fff";
      context.font = "700 20px Arial";
      wrapCanvasText(context, card.innerText.trim(), x + 16, y + 34, cardWidth - 32, 25);
    });
    context.drawImage(ink, 0, 0, output.width, output.height);
    return output.toDataURL("image/jpeg", 0.88);
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
    if (!selection || !question.trim()) return;
    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;
    setStage("analyzing");
    setError("");
    try {
      const image = await makeSlideImage();
      setCapturedImage(image);
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json", ...sessionHeaders() },
        signal: controller.signal,
        body: JSON.stringify({
          image,
          page: currentSlide.page,
          question: question.trim(),
          selection,
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
    clearDrawing();
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

  const recordFeedback = (value: "up" | "down") => {
    setFeedback(value);
    setNotice(value === "up" ? "Đã ghi nhận: câu trả lời hữu ích." : "Đã ghi nhận: cần cải thiện câu trả lời này.");
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
              <h1>day04-prompt-engineering-tool-calling.pdf</h1>
              <p>COMP2010 · Lecture_material_ms204i6x_gqwyya</p>
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
            <span className="strokeLabel">NÉT</span>
            <span className="strokePreview" />
          </div>

          <div className="slidesViewport">
            <div className="sideTab">▹</div>
            <div className="slideTestPicker" aria-label="Bộ slide kiểm thử">
              <span>5 SLIDE TEST</span>
              <div>
                {TEST_SLIDES.map((slide, index) => (
                  <button
                    key={slide.page}
                    className={`slideThumb thumb-${slide.accent} ${
                      index === slideIndex ? "active" : ""
                    }`}
                    onClick={() => changeSlide(index)}
                    aria-label={`Mở trang ${slide.page}: ${slide.title.replace("\n", " ")}`}
                  >
                    <small>Trang {slide.page}</small>
                    <strong>{slide.title.replace("\n", " ")}</strong>
                    <i>{slide.cards.length} khối hình</i>
                  </button>
                ))}
              </div>
            </div>
            {slideIndex > 0 ? (
              <SlidePreview
                slide={TEST_SLIDES[slideIndex - 1]}
                muted
                onSelect={() => changeSlide(slideIndex - 1)}
              />
            ) : null}
            <article className="slideSheet currentSlide" style={{ "--slide-zoom": zoom } as CSSProperties}>
              <div className="slideMeta">
                <span>Trang {currentSlide.page} / 43</span>
                <span>day04-prompt-engineering-tool-calling.pdf</span>
              </div>
              <div className="slideCanvas" ref={slideRef}>
                <div className={`slideArtwork accent-${currentSlide.accent}`}>
                  <div className="slideSectionLabel">{currentSlide.section}</div>
                  <div className="slideCopy">
                    <h2>{currentSlide.title.split("\n").map((line, index) => (
                      <span key={line}>{line}{index === 0 ? <br /> : null}</span>
                    ))}</h2>
                    <p>{currentSlide.description}</p>
                  </div>
                  <div className="slideVisual" aria-label="Nội dung trực quan của slide">
                    {currentSlide.cards.map((card) => (
                      <div className="visualCard" key={card}>{card}</div>
                    ))}
                  </div>
                  <div className="slideDecoration" aria-hidden="true">
                    {currentSlide.section}
                  </div>
                </div>
                <canvas
                  ref={canvasRef}
                  className="annotationCanvas"
                  aria-label="Lớp annotation của trang 11"
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={finishDrawing}
                  onPointerCancel={finishDrawing}
                  aria-disabled={annotationTool === "read"}
                />
                {stage !== "draw" && selection ? (
                  <div
                    className="detectedBox"
                    style={{
                      left: `${selection.x}%`,
                      top: `${selection.y}%`,
                      width: `${selection.width}%`,
                      height: `${selection.height}%`,
                    }}
                  >
                    <span>Vùng AI nhận được</span>
                  </div>
                ) : null}
              </div>
              <p className="noteHint">
                Kéo đến trang này để mở note riêng của trang.
              </p>
            </article>
            {slideIndex < TEST_SLIDES.length - 1 ? (
              <SlidePreview
                slide={TEST_SLIDES[slideIndex + 1]}
                onSelect={() => changeSlide(slideIndex + 1)}
              />
            ) : null}
          </div>

          <div className="pageNavigation">
            <button onClick={() => changeSlide(slideIndex - 1)} disabled={slideIndex === 0 || stage === "analyzing"}>‹</button>
            <span>Trang {currentSlide.page} / 43</span>
            <button onClick={() => changeSlide(slideIndex + 1)} disabled={slideIndex === TEST_SLIDES.length - 1 || stage === "analyzing"}>›</button>
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
            <div className="assistantMessage">
              Xin chào! Khoanh vùng trên slide, sau đó hỏi mình về đúng phần
              bạn chưa hiểu nhé.
            </div>

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

            {stage !== "draw" ? (
              <div className="studentMessage">{question}</div>
            ) : null}

            {stage === "analyzing" ? (
              <div className="assistantMessage responseCard loadingCard">
                <span className="visionSpinner" aria-hidden="true" />
                <strong>Vision đang đọc vùng bạn khoanh…</strong>
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
                  <button className="primaryAction" onClick={() => setStage("answer")}>
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
                  <button className="secondaryAction" onClick={() => setStage("answer")}>
                    Vẫn dùng vùng này
                  </button>
                </div>
              </div>
            ) : null}

            {stage === "answer" && analysis ? (
              <div className="assistantMessage responseCard answerCard">
                <span className="confidenceLabel">GIẢI THÍCH THEO SLIDE {currentSlide.page}</span>
                <strong>{analysis.answerTitle}</strong>
                <p>{analysis.answer}</p>
                <div className="citation">Nguồn: Trang {currentSlide.page} · {analysis.evidence}</div>
                <div className="answerFeedback">
                  <span>Câu trả lời này có hữu ích không?</span>
                  <button className={feedback === "up" ? "feedbackActive" : ""} onClick={() => recordFeedback("up")} aria-pressed={feedback === "up"}>👍</button>
                  <button className={feedback === "down" ? "feedbackActive" : ""} onClick={() => recordFeedback("down")} aria-pressed={feedback === "down"}>👎</button>
                </div>
              </div>
            ) : null}

            {stage === "error" ? (
              <div className="assistantMessage responseCard errorCard">
                <span className="confidenceLabel warning">CHƯA THỂ PHÂN TÍCH</span>
                <strong>{error}</strong>
                <p>
                  Bạn có thể thử lại hoặc khoanh vùng rõ hơn. Nếu lỗi nói về API key,
                  kiểm tra key ở môi trường server; khóa không bao giờ được gửi xuống trình duyệt.
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
              disabled={!selection || !question.trim() || stage !== "draw"}
              onClick={submitQuestion}
            >
              ➤
            </button>
            <div className="composerHint">
              {selection
                ? `Đã nhận vùng khoanh trên trang ${currentSlide.page}`
                : "Dùng bút khoanh một vùng để bắt đầu"}
            </div>
            {notice ? <div className="composerNotice" role="status">{notice}</div> : null}
          </div>
        </aside>
      </section>
    </main>
  );
}

function SlidePreview({
  slide,
  muted = false,
  onSelect,
}: {
  slide: (typeof TEST_SLIDES)[number];
  muted?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`slideSheet previewSheet previewButton ${muted ? "muted" : ""}`}
      onClick={onSelect}
      aria-label={`Chọn trang ${slide.page} để khoanh vùng`}
    >
      <div className="slideMeta">
        <span>Trang {slide.page} / 43</span>
        <span>day04-prompt-engineering-tool-calling.pdf</span>
      </div>
      <div className={`previewArtwork preview-${slide.accent}`}>
        <h3>{slide.title.replace("\n", " ")}</h3>
        <div className="methodGrid">
          {slide.cards.slice(0, 4).map((card) => <span key={card}>{card}</span>)}
        </div>
      </div>
      <span className="previewAction">Bấm để mở và khoanh trang {slide.page}</span>
    </button>
  );
}

function RegionPreview({
  selection,
  title,
  image,
  page,
}: {
  selection: SelectionBox | null;
  title: string;
  image: string | null;
  page: number;
}) {
  return (
    <div className="regionPreview" aria-label="Xem trước vùng đã khoanh">
      <div className="miniSlide">
        {image ? (
          // Preview is a client-generated data URL, not a remote production image.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={`Ảnh vùng khoanh trang ${page}`} />
        ) : null}
        {selection ? (
          <span
            className="miniSelection previewDetectedBox"
            style={{
              left: `${selection.x}%`,
              top: `${selection.y}%`,
              width: `${selection.width}%`,
              height: `${selection.height}%`,
            }}
          />
        ) : null}
      </div>
      <div>
        <span>Trang {page}</span>
        <strong>{title}</strong>
      </div>
    </div>
  );
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/);
  let line = "";
  let lineIndex = 0;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      context.fillText(line, x, y + lineIndex * lineHeight);
      line = word;
      lineIndex += 1;
    } else {
      line = candidate;
    }
  }
  if (line) context.fillText(line, x, y + lineIndex * lineHeight);
}
