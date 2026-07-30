/* eslint-disable @next/next/no-img-element -- static PDF raster previews need no image optimization. */
import type { CourseSlide } from "../lib/tutor-ui";

export function SlidePreview({
  slide,
  muted = false,
  onSelect,
}: {
  slide: CourseSlide;
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
        <span>Trang {slide.page} / 10</span>
        <span>AI & LLM Foundation - Khoá 1</span>
      </div>
      <div className="previewArtwork">
        <img src={slide.image} alt={`Xem trước trang ${slide.page} của bài giảng Khoá 1`} />
      </div>
      <span className="previewAction">Bấm để mở và khoanh trang {slide.page}</span>
    </button>
  );
}
