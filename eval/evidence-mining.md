# Evidence mining — VLearn Tutor

## Phương pháp để kiểm lại

- Nguồn cục bộ được cấp cho hackathon: `data/vlearn-pack/chatlog/chat_history_anonymized_for_hackathon.csv`.
- Đơn vị đếm: mỗi `turn_id` là một cặp student–tutor. Đối chiếu các trường `citations` và `asked_check_question` theo [Data Dictionary](../data/vlearn-pack/chatlog/DATA_DICTIONARY.md).
- Các số tổng hợp dùng trong `spec.md`: 1.261 turn, 46,2% tutor response có `citations=[]`, và chỉ 3 turn có `asked_check_question=True`.
- Chỉ lưu đoạn trích tối thiểu bên dưới để minh hoạ pain; không sao chép toàn bộ chatlog, `user_id`, `conversation_id` hay nội dung không cần thiết.

## Năm ví dụ ngắn có thể truy vết

| `turn_id` | Đoạn học viên chọn/hỏi (rút gọn) | `citations` của tutor | Tín hiệu |
|---|---|---|---|
| `T0649` | “tóm tắt nội dung chính trong slide này” (trang 37) | `[]` | Câu hỏi phụ thuộc vào vùng/slide nhưng đáp án không có citation. |
| `T0905` | “tóm gọn những nội dung quan trọng nhất trong day 04 này” (trang 50) | `[]` | Cần xác định rõ phạm vi trước khi trả lời tóm tắt. |
| `T0092` | “kỹ thuật tối ưu prompt, cơ chế gọi tool và cách xử lý ngữ cảnh” (trang 50) | `[]` | Nhiều khái niệm trong một vùng; dễ trả lời lệch phần người học cần. |
| `T0154` | “tại sao có lưu ý như trang 25” | `[]` | Câu hỏi chỉ có tham chiếu trang, không đủ text vùng chọn để grounding chắc chắn. |
| `T1053` | “Format: Output trông như thế nào?” (trang 17) | `[17]` | Ví dụ đối chứng: khi vùng/citation rõ, có thể trỏ đúng căn cứ. |

## Kết luận cho lát cắt

Đây không phải bằng chứng rằng mọi câu trả lời không citation đều sai. Nó cho thấy input
theo kiểu “trang/đoạn được chọn” thường thiếu chi tiết để người học và AI cùng xác nhận
đang nói về đâu. Prototype thử đưa ảnh + nét khoanh + toạ độ vào input và bắt AI thể hiện
uncertainty/khoanh lại nếu không nhận diện được vùng.
