# AI SPEC — Khoanh để hỏi · Nhóm D305

**Hướng:** A — VLearn · **Loại:** Tối ưu trải nghiệm AI tutor hiện có
**Trạng thái:** quality bar được chốt trong tài liệu này; kết quả chạy và feedback bên dưới chỉ được điền sau khi có lượt thử thật.

## §1. User & Job

- **Job executor + workflow:** Học viên đang xem slide/tài liệu trong VLearn, gặp một đoạn chưa hiểu, chọn vùng cần hỏi rồi gửi câu hỏi cho Tutor.
- **Core JTBD:** “Khi tôi vướng một đoạn cụ thể trong tài liệu, tôi muốn chỉ đúng đoạn đó và nhận lời giải thích bám vào nó để tiếp tục học mà không phải mô tả lại ngữ cảnh.”
- **Problem statement:** Khi hỏi về một vùng nhỏ trong slide, học viên khó chỉ ra chính xác phần đang vướng; câu trả lời có thể thiếu căn cứ hoặc đi lệch đoạn đang học, làm mất thời gian đối chiếu và có thể học sai.

### Evidence mining (nguồn: `data/vlearn-pack/chatlog/DATA_DICTIONARY.md`)

| Quan sát có thể kiểm lại | Ý nghĩa với lát cắt |
|---|---|
| 1.261 lượt hỏi–đáp của 369 học viên, trong 585 hội thoại | Pain đủ rộng để kiểm tra bằng prototype, không dựa vào một anecdote đơn lẻ. |
| 46,2% câu trả lời tutor có `citations = []` | Trả lời thiếu grounding là rủi ro chính; UI phải cho thấy evidence và fallback khi không nhận được vùng rõ. |
| `asked_check_question = True` chỉ 3/1.261 lượt | Hệ thống hiếm khi xác nhận lại mức hiểu/ngữ cảnh; prototype thêm bước AI xác nhận vùng trước khi giải thích. |
| Median latency 1.758 ms, p90 3.686 ms, max 23.848 ms | Cần trạng thái đang xử lý, timeout và không “giả vờ đã xong”. |
| 33 đánh giá up, 37 down, phần lớn chưa rating | Validation trực tiếp cần hỏi định tính thay vì suy diễn hài lòng từ rating thưa. |

**Log còn thiếu để đạt evidence chuẩn B:** Trần Việt Trường sẽ bổ sung ít nhất 5 đoạn trích ngắn, được phép dùng, từ các `turn_id` ẩn danh vào `eval/evidence-mining.md`; không dán chatlog thô hay thông tin nhận diện vào repo.

## §2. Impact & quyết định chọn

| Ứng viên | Người bị ảnh hưởng | Tần suất / tín hiệu | Chi phí mỗi lần | Khả thi trong hackathon |
|---|---:|---|---|---|
| Khoanh vùng để hỏi (chọn) | 369 học viên trong data pack | 1.261 turn; 46,2% không citation | Học viên phải gõ lại/mô tả lại vùng và tự đối chiếu | Cao: một flow ảnh + tọa độ + AI response |
| Câu hỏi kiểm tra hiểu tự động | 369 | Chỉ 3 lượt `asked_check_question=True` | Có thể bỏ sót hiểu lầm | Trung bình: cần logic sư phạm và đánh giá dài hạn |
| Tóm tắt toàn bộ bài | Không đo được từ mining hiện có | Không có signal pain trực tiếp | Dễ tạo output chung chung | Thấp: không chứng minh được impact trong thời gian ngắn |

**Ứng viên đã loại:** Tóm tắt toàn bộ bài vì chưa có bằng chứng pain/impact định lượng trực tiếp. Câu hỏi kiểm tra hiểu được giữ làm hướng tiếp theo, nhưng không chọn vì khó đánh giá đúng/sai trong lát cắt 1,5 ngày.

**Ứng viên chọn:** Khoanh vùng để hỏi vì tác động vào rủi ro grounding (46,2% không citation), tạo được input rõ hơn cho AI và có thể kiểm thử end-to-end bằng một ảnh vùng chọn.

## §3. Giải pháp tương tự đã nghiên cứu

| Hướng tham chiếu | Điều học | Không sao chép máy móc |
|---|---|---|
| Annotation trên tài liệu | Vùng chọn là context tường minh, không bắt người dùng mô tả bằng lời | Không biến prototype thành trình đọc/ghi chú hoàn chỉnh. |
| Chat có citation | Câu trả lời phải nói rõ căn cứ hoặc thừa nhận không có căn cứ | Không bịa số trang/citation khi model không xác định được vùng. |

## §4. Thiết kế

**Lát cắt một câu:** *Một học viên đang xem slide khoanh một vùng và hỏi; AI quyết định vùng đó có đủ rõ để hiểu không; kết quả là xác nhận vùng + lời giải thích tiếng Việt có evidence hoặc yêu cầu khoanh lại.*

### Scope

- **Mức prototype:** **Working**. Frontend chụp slide + annotation; server gửi ảnh, vùng và câu hỏi tới model đa phương thức, kiểm tra structured output rồi trả kết quả về UI.
- **AI thật:** quyết định trung tâm là nhận diện/xác nhận vùng và tạo giải thích. `codebase/` không chứa API key.
- **Mock:** Không có PDF upload, đăng nhập thật, retrieval tài liệu đa chương, hay analytics production.
- **Non-goals:** (1) giải toàn bộ bài tập; (2) thay thế tutor/người chấm; (3) lưu/chia sẻ annotation giữa người dùng; (4) trả lời ngoài vùng/tài liệu đã chọn.
- **Automation:** **augment** — AI đề xuất vùng hiểu được và giải thích, học viên vẫn xác nhận hoặc khoanh lại. Cost of error là học sai nội dung, nên không tự động khẳng định khi confidence thấp.

### Nguyên tắc áp dụng

| Nguyên tắc | Áp dụng cụ thể |
|---|---|
| Context rõ trước khi sinh câu trả lời | Gửi ảnh slide, lớp nét khoanh và tọa độ vùng cùng câu hỏi. |
| Hiển thị trạng thái hệ thống | UI có trạng thái gửi/đang xử lý/lỗi và timeout. |
| Uncertainty có hành động tiếp theo | `<70%` confidence hoặc vùng nhỏ/mơ hồ → yêu cầu xác nhận hoặc khoanh lại. |
| User giữ quyền sửa | Học viên có thể sửa vùng khoanh và đặt lại câu hỏi, không bị khoá vào kết quả đầu. |
| Căn cứ có thể kiểm tra | Server yêu cầu evidence trong output; UI không biến câu trả lời không căn cứ thành câu khẳng định chắc chắn. |

## §5. Kiểu lỗi — 4 lớp chỗ khó

| # | Lớp | Kịch bản | Hành vi mong muốn |
|---:|---|---|---|
| 1 | ① Nguồn sự thật | Chọn vùng không nằm trên slide | Nói không xác định được vùng, không bịa nội dung; yêu cầu khoanh lại. |
| 2 | ① Nguồn sự thật | Model không tìm được evidence trên ảnh | Trả lời “chưa có căn cứ”, nêu phần cần cung cấp thêm. |
| 3 | ② Mơ hồ | Vùng quá nhỏ | Cờ `needsConfirmation`; hướng dẫn phóng to/khoanh lại. |
| 4 | ② Mơ hồ | Vùng chạm tiêu đề và hai đoạn | Nêu vùng hiểu được, yêu cầu xác nhận phạm vi trước khi giải thích sâu. |
| 5 | ③ Ngoài phạm vi | Học viên yêu cầu đáp án thi/điểm số | Từ chối quyết định thay người chấm, gợi ý giải thích khái niệm trong vùng. |
| 6 | ③ Ngoài phạm vi | Câu hỏi không liên quan ảnh | Nhắc phạm vi feature và mời chọn vùng tài liệu liên quan. |
| 7 | ④ Domain | Công thức bị cắt mất ký hiệu | Không suy đoán ký hiệu bị thiếu; yêu cầu vùng rộng hơn. |
| 8 | ④ Domain | Text nhỏ, OCR/vision đọc nhầm | Đánh dấu confidence thấp, hiển thị phần AI nghĩ đã đọc để học viên sửa. |
| 9 | ④ Domain | Nội dung slide mâu thuẫn với câu hỏi | Ưu tiên nội dung thấy được trên slide và nêu điểm mâu thuẫn. |
| 10 | ④ Domain | Response quá dài khi chỉ hỏi định nghĩa | Trả lời theo lớp: xác nhận → giải thích ngắn → evidence; chỉ mở rộng khi người học hỏi tiếp. |

## §6. Bốn đường đi của trải nghiệm

- **Happy path:** khoanh tiêu đề/đoạn rõ → AI xác nhận đúng vùng → giải thích + evidence.
- **Low-confidence (②):** khoanh chồng nhiều khối hoặc quá nhỏ → AI hiển thị vùng nhận diện và yêu cầu xác nhận/khoanh lại.
- **Failure / không căn cứ (①):** ảnh lỗi hoặc không đủ chữ → không trả lời đoán; báo thiếu căn cứ và nút thử lại.
- **Correction:** học viên sửa vùng/câu hỏi → gửi lại một lượt mới; kết quả cũ không bị ghi đè âm thầm.
- **Ngoài phạm vi (③):** yêu cầu đáp án/điểm → từ chối nhẹ nhàng, chuyển về giải thích vùng đang chọn.
- **Case domain (④):** công thức/diagram/crop chữ → khuyến nghị chọn toàn bộ công thức/legend trước khi giải thích.

## §7. Kiểm thử

| Chiều chất lượng | Định nghĩa kiểm chứng được |
|---|---|
| Grounding vùng | Người chấm nhìn ảnh và xác nhận `recognizedRegion` khớp vùng chọn; đúng khi 2/2 chấm đồng ý. |
| An toàn khi mơ hồ | Case mơ hồ/nhỏ phải có `needsConfirmation=true`; không cho lời giải thích khẳng định. |
| Evidence | Case trả lời được phải có evidence bám ảnh; case không có evidence phải nêu giới hạn. |
| Hữu ích | Người thử trả lời “biết bước tiếp theo” sau một lượt; log nguyên văn. |
| Độ tin cậy vận hành | Lỗi timeout/upstream trả message phục hồi, không crash UI hoặc lộ key. |

- **Golden set:** [eval/golden-region-cases.json](eval/golden-region-cases.json), 20 case: 10 case thường, 2 case mỗi lớp khó và 2 case hiếm. Case tham chiếu data chỉ ghi `turn_id` ẩn danh/mô tả, không chứa chatlog thô.
- **Quality bar (chốt):** đạt khi **≥85%** case đúng grounding/safety, **100%** case nguồn không rõ hoặc confidence thấp yêu cầu xác nhận/không bịa, và **0** response lộ API key/PII trong log.
- **Kết quả chạy:** chưa điền. Khi được phép thực hiện call thật, ghi một lượt đầy đủ (kể cả case fail) vào [eval/vision-run-log.md](eval/vision-run-log.md); không thay đổi quality bar sau lượt chạy.

## §8. Phân công & kế hoạch

Xem chi tiết owner, nhánh và điều kiện bàn giao ở [TEAM_TASKS.md](TEAM_TASKS.md).

- Hoàng Mạnh Dũng: UI/annotation/PDF, luồng demo và kiểm thử giao diện.
- Trần Việt Trường: evidence, golden set, log kết quả, user validation, báo cáo và reflection.
- **Willing users:** cần chốt tối thiểu 3 người ngoài nhóm trước CP5; danh sách đồng ý và log chỉ ghi ở `validation/` sau khi có sự đồng ý.

## §9. Changelog

| Thời điểm | Đổi gì | Vì sao |
|---|---|---|
| 2026-07-30 | Tạo artifact nền: spec, prototype, golden set thiết kế và form validation | Chuyển từ repo đề bài sang cấu trúc nộp có thể audit; chưa ghi nhận kết quả run/user test giả. |
