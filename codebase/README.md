# Khoanh để hỏi — VLearn Tutor CP3

CP3 production nối flow khoanh vùng của CP2 với OpenAI Vision thật. Học viên khoanh một
vùng trên slide, Tutor đọc ảnh và tọa độ vùng, xác nhận phần đã hiểu rồi giải
thích bằng tiếng Việt với bằng chứng lấy từ chính slide.

## Flow chính

1. Dùng chuột hoặc bút khoanh một vùng trên slide 11.
2. Nhập câu hỏi và gửi cho Tutor.
3. Server tạo yêu cầu đa phương thức gồm ảnh slide, nét khoanh, tọa độ và câu hỏi.
4. Vision trả về structured output: vùng nhận diện, độ tin cậy, câu xác nhận,
   lời giải thích và bằng chứng.
5. Vùng mơ hồ hoặc độ tin cậy thấp luôn yêu cầu học viên xác nhận/khoanh lại.

## Khả năng production

- Chụp trực tiếp nội dung slide và lớp annotation đang hiển thị trong trình duyệt.
- Structured output được kiểm tra lại ở server trước khi trả về giao diện.
- Giới hạn 15 câu/ngày theo định danh ẩn danh đã băm.
- Lịch sử 20 câu gần nhất được lưu bền vững trong Cloudflare D1.
- Có timeout, giới hạn kích thước ảnh, kiểm tra MIME/tọa độ và xử lý lỗi upstream.
- API key chỉ tồn tại ở server hoặc secret store của hosting.

## Cấu hình

Sao chép `.env.example` thành `.env.local` và điền khóa ở phía server:

```dotenv
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-terra
```

Khóa API không được đưa vào mã client. `OPENAI_MODEL` có thể đổi mà không sửa mã.

## Chạy và kiểm thử

```bash
pnpm install
pnpm dev
pnpm test
pnpm test:vision
```

Golden set nằm ở `tests/golden-region-cases.json`, gồm vùng tiêu đề rõ,
vùng chạm nhiều khối nội dung và vùng quá nhỏ. `pnpm test:vision` gửi từng case
tới OpenAI Vision thật và kiểm tra cờ xác nhận cùng ngưỡng confidence. Ở runtime,
server luôn chuyển kết quả dưới 70% sang trạng thái yêu cầu học viên xác nhận lại.
