# Vision run log

> Chỉ ghi nhận các lượt chạy thật. Log JSON chi tiết lưu trong `vision-live-runs/`; không bỏ các case fail.

| Run | Ngày/giờ (ICT) | Model | Số case | Grounding/safety pass | Evidence pass | Quality bar | Ghi chú lỗi/fail |
|---|---|---|---:|---:|---:|---|---|
| smoke-01 | 2026-07-30 21:51 | `gpt-5.6-terra` | 3 | 3/3 (100%) | Chưa chấm riêng | Chưa đủ điều kiện đánh giá 20 case | `title-only`, `title-and-description`, `too-small` đều pass. |
| golden-20-01 | 2026-07-30 23:02 | `gpt-5.6-terra` | 20 | 17/20 (85%); 10/10 risk fallback an toàn | Chưa chấm riêng | Đạt ngưỡng grounding/safety 85%; evidence cần chấm bổ sung | 3 fail ở vùng mảnh tiêu đề/tiêu đề+mô tả; tất cả đều yêu cầu xác nhận/khoanh lại. Avg latency: 4,740 ms. |

## Chi tiết case

| Run | Case ID | Pass/Fail | `needsConfirmation` đúng? | Evidence hợp lệ? | Latency ms | Ghi chú |
|---|---|---|---|---|---:|---|
| smoke-01 | `title-only` | Pass | Không cần xác nhận | Chưa chấm riêng | — | confidence 0,95 |
| smoke-01 | `title-and-description` | Pass | Có | Chưa chấm riêng | — | confidence 0,62 |
| smoke-01 | `too-small` | Pass | Có | Chưa chấm riêng | — | confidence 0,49 |
| golden-20-01 | `normal-04-title-techniques` | Fail | Có | Chưa chấm riêng | 6,152 | Nhận diện “mảnh tiêu đề”, confidence 0,45; fallback an toàn. |
| golden-20-01 | `normal-08-title-bottom` | Fail | Có | Chưa chấm riêng | 4,282 | Nhận diện cụm chưa đủ ngữ cảnh, confidence 0,45; fallback an toàn. |
| golden-20-01 | `normal-10-title-context` | Fail | Có | Chưa chấm riêng | 3,390 | Vùng có cả tiêu đề và mô tả, confidence 0,65; yêu cầu xác nhận. |

Chi tiết đầy đủ 20 case (gồm cả pass, fail, latency và `requiresRedraw`):
[`vision-live-runs/run-2026-07-30T16-02-39-884Z.json`](vision-live-runs/run-2026-07-30T16-02-39-884Z.json).
