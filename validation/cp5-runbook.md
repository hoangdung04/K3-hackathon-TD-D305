# CP5 runbook — Khoanh để hỏi

Tài liệu này dùng để thu thập **kết quả thật** trước khi gửi form CP5. Không thay
thế feedback hoặc số đo bằng nội dung minh hoạ.

## Điều kiện hoàn tất

- [ ] Có 5 người thử ngoài nhóm, ghi bằng mã `U01`–`U05`; mỗi người đã đồng ý.
- [ ] Có ít nhất 2 quote nguyên văn, mỗi quote gắn đúng mã người thử.
- [ ] Mỗi người hoàn thành 2 task: một vùng rõ và một vùng mơ hồ/trống.
- [ ] Ghi một thay đổi thực hiện từ feedback, hoặc lý do có căn cứ để chưa đổi.
- [ ] Chạy đủ 20 case trong `eval/golden-region-cases.json`, lưu cả pass và fail.
- [ ] Chạy demo có bấm giờ và ghi thời lượng thực.

## Kịch bản user test (7 phút/người)

1. Xin đồng ý: chỉ ghi mã người thử và lời nói họ cho phép ghi lại; không ghi PII.
2. Task A: khoanh một tiêu đề/cụm rõ, hỏi “Giải thích phần tôi vừa khoanh”.
3. Task B: khoanh một vùng quá nhỏ, vùng trống hoặc một mảnh cụm không đủ nghĩa.
4. Hỏi nguyên văn: “Bạn có biết bước tiếp theo không?”, “Phần nào làm bạn
   không tin hoặc khó hiểu?”, “Bạn có dùng lúc tự học không, vì sao?”.
5. Ghi nguyên văn câu trả lời vào `feedback-log.md`; không sửa câu chữ để làm đẹp kết quả.

## Mẫu ghi nhanh

| Mã | Đồng ý | Task A | Task B | Quote nguyên văn | Thay đổi cần làm |
|---|---|---|---|---|---|
| U01 | Có | Pass/Fail | Pass/Fail |  |  |
| U02 | Có | Pass/Fail | Pass/Fail |  |  |
| U03 | Có | Pass/Fail | Pass/Fail |  |  |
| U04 | Có | Pass/Fail | Pass/Fail |  |  |
| U05 | Có | Pass/Fail | Pass/Fail |  |  |

## Demo bấm giờ — 5 phút

| Mốc | Thời lượng | Người nói | Nội dung cần chứng minh |
|---|---:|---|---|
| Pain & evidence | 0:00–0:35 | Trần Việt Trường | Vấn đề trả lời lệch vùng/citation. |
| Lát cắt | 0:35–1:00 | Hoàng Mạnh Dũng | Khoanh → Entropy xác nhận → giải thích/khoanh lại. |
| Happy path live | 1:00–2:30 | Hoàng Mạnh Dũng | Khoanh keyword/cụm rõ và nhận giải thích có evidence. |
| Fallback live | 2:30–3:20 | Hoàng Mạnh Dũng | Chấm/nét kẻ/vùng trống bị yêu cầu khoanh lại. |
| Evaluation | 3:20–4:15 | Trần Việt Trường | Tổng case, pass/fail thật, quality bar. |
| Validation & giới hạn | 4:15–5:00 | Trần Việt Trường | 5 feedback, thay đổi đã làm, việc còn lại. |

Sau buổi dry run, ghi thời lượng thực và phần quá giờ vào `validation/feedback-log.md`.
