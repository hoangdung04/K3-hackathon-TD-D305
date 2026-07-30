import type { SelectionBox } from "../lib/tutor-ui";

export function RegionPreview({
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
