# Bảng chia việc — Nhóm D305

GitHub Issues đang tắt ở repo này, nên nhóm dùng file này làm task board và làm việc qua branch + pull request (PR). Một artifact chỉ có **một owner chính** để tránh ghi đè.

| Người | Owner / nhánh đề xuất | Việc bàn giao | Done khi |
|---|---|---|---|
| **Hoàng Mạnh Dũng — Tool & UI** | `feat/ui-pdf-region` | `codebase/app/page.tsx`, các component UI; load PDF/slide, vẽ-khoanh, crop/preview, trạng thái loading–error–retry; ảnh/flow cho demo; `demo-slides/` | Luồng 5 phút chạy từ mở tài liệu → khoanh → hỏi → AI trả/đòi khoanh lại; `pnpm test` + `pnpm lint` pass; PR ghi rõ phần mock. |
| **Trần Việt Trường — Evaluation & Report** | `feat/eval-validation` | `spec.md`, `eval/`, `validation/`, `reflection/`; mining theo `turn_id`, hoàn tất 20 golden cases, chạy/lưu đủ kết quả thật, user test, changelog và slide narrative | Golden set đủ 20 case, có lượt run đầy đủ %, ≥5 feedback từ ≥5 người ngoài nhóm, ≥1 cải tiến ghi changelog; PR không chứa raw chatlog hay API key. |

## Thứ tự phối hợp

1. Hoàng chốt contract response UI: `recognizedRegion`, `confidence`, `needsConfirmation`, `explanation`, `evidence`.
2. Trường dùng đúng contract đó để chấm golden set; nếu phát hiện case fail, mở PR/ghi issue nội bộ trong phần “Nhật ký quyết định” bên dưới.
3. Hoàng sửa UI/prompt theo case có ID; Trường rerun toàn bộ golden set và cập nhật `vision-run-log.md`.
4. Cả hai dry-run demo: mỗi người nói phần mình sở hữu và giải thích được code/artifact đó.

## Checklist nộp

- [x] Cấu trúc `spec.md`, `codebase/`, `eval/`, `validation/`, `reflection/`.
- [x] Prototype Working đã được đưa vào `codebase/`; `.env.local`, `node_modules`, build output bị loại khỏi repo.
- [ ] Hoàng: PDF/document input thật hoặc nêu rõ slide demo là giới hạn prototype.
- [ ] Hoàng: tạo `demo-slides.pdf` 6 trang sau dry-run.
- [x] Trường: bổ sung 5 evidence quote ngắn có `turn_id` vào `eval/evidence-mining.md` theo quy định data.
- [ ] Trường: chạy 20 case AI thật và ghi toàn bộ kết quả vào `eval/vision-run-log.md`.
- [ ] Trường: user validation ≥5 mẩu từ ≥5 người ngoài nhóm vào `validation/feedback-log.md`.
- [ ] Cả hai: chọn thay đổi từ feedback/case fail và ghi vào `spec.md` §9.

## Nhật ký quyết định / handoff

| Ngày | Case / phản hồi | Quyết định | Owner | PR / commit |
|---|---|---|---|---|
| 2026-07-30 | Nền tảng submission | Chưa bịa live result hoặc feedback; để template chờ dữ liệu thật | Cả hai | `codex/submission-foundation` |
