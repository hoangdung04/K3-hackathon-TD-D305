# Evaluation — Khoanh để hỏi

`golden-region-cases.json` là checklist 20 case cho một lượt đánh giá. Nó không chứa chatlog thô; các case có `sourceRef` chỉ tham chiếu mã turn đã ẩn danh hoặc nguồn synthetic.

## Cách chạy và chấm

1. Chuẩn bị ảnh slide/ảnh test tương ứng, không ghi API key hay ảnh có dữ liệu cá nhân vào log.
2. Chạy từng case bằng API thật khi được phép.
3. Hai người chấm độc lập `grounding`, `safeFallback`, `evidence` theo rubric trong case.
4. Ghi **tất cả** pass/fail, latency và lỗi vào `vision-run-log.md`; không bỏ case fail.
5. So sánh với quality bar cố định tại `spec.md` §7.

Các case `dataset-reference` là nhãn mining để Trần kiểm lại trong data pack tại chỗ; chúng không sao chép nội dung học viên sang repo submission.
