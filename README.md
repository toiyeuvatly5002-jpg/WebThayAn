# Triển khai Phòng học Thầy An trên Netlify

Giải nén toàn bộ dự án. Thư mục gốc chứa netlify.toml, package.json, netlify/functions và public. Trang đăng nhập, phông chữ, ảnh mẫu và trình hiển thị toán được phục vụ bởi Netlify. Tài khoản, phiên đăng nhập, đề đã đăng, lời giải, mẫu tùy chỉnh và điểm được lưu trong Firebase Realtime Database. Máy học sinh truy cập cùng một địa chỉ web.

## 1. Chuẩn bị Firebase và biến môi trường

Dùng Firebase Realtime Database. Nếu đang dùng Firestore riêng thì tạo thêm Realtime Database trong cùng project. Ứng dụng dùng nhánh phongHocV2. Với database mới, thư viện khởi tạo trống. Database đã chạy bản máy chủ V2–V4 có thể tiếp tục dùng cùng nhánh.

Đặt quyền đọc và ghi trực tiếp của client ở nhánh này thành false. Kiểm tra các quy tắc ở cấp cha, vì quyền đã cấp ở cấp cha áp dụng cho các cấp con. Máy chủ dùng Firebase Admin SDK. Khi database còn trống và chỉ dùng cho app này, có thể dùng bộ quy tắc sau:

    {"rules":{".read":false,".write":false,"phongHocV2":{"items":{".indexOn":["id"]}}}}

Trong Netlify → Project configuration → Environment variables, tạo ba biến có phạm vi Functions (và chọn ngữ cảnh Production nếu được hỏi):

| Tên | Giá trị |
| --- | --- |
| FIREBASE_DATABASE_URL | URL Realtime Database, sao chép nguyên từ Firebase Console. |
| FIREBASE_SERVICE_ACCOUNT | Toàn bộ JSON tài khoản dịch vụ của Firebase có quyền đọc/ghi database. Đặt trong biến bí mật trên Netlify. |
| BOOTSTRAP_ADMIN_CODE | Mã admin đầu tiên do thầy chọn, đúng 5 chữ số, dùng để khởi tạo database mới. |

Sau lần đăng nhập đầu, vào Quản trị → Cấp mã đăng nhập để cấp mã học sinh. Khi đã có dữ liệu tài khoản, thay BOOTSTRAP_ADMIN_CODE không thay đổi mã đã cấp. Các mã trong bản HTML thử nghiệm trước đây thuộc dữ liệu của trình duyệt thử nghiệm.

## 2. Triển khai

Cách dùng Git: đưa nội dung thư mục đã giải nén vào repo, kết nối repo với site trên Netlify, chọn Deploy. Nếu dùng thư mục con, đặt Base directory đến thư mục chứa netlify.toml. Netlify đọc cấu hình build, thư mục public và thư mục Functions từ file này.

Cách dùng máy cá nhân: cài Node.js 22 và chạy các lệnh dưới đây từ thư mục đã giải nén. Lệnh link cho phép chọn đúng site Netlify của thầy. Lệnh cuối triển khai lên site đó.

    npm install
    npx netlify-cli login
    npx netlify-cli link
    npx netlify-cli deploy --build --prod

Ứng dụng cần Netlify Functions để đăng nhập, chấm điểm và kiểm tra quyền. Sử dụng một trong hai cách trên để cả hàm school và giao diện được triển khai cùng nhau. Sau khi cấu hình biến môi trường mới, triển khai lại. ZIP này là dự án triển khai qua Git/CLI; kéo riêng public vào Netlify Drop chỉ đưa lên các tệp tĩnh.

## Tạo đề PDF

Mở Quản trị → Tạo đề và tài liệu, chọn phòng, lớp, môn và nội dung. Dán liên kết chia sẻ Google Drive của PDF đề và PDF lời giải. Cho phép học sinh xem hai tệp. Với tệp đáp án, chọn quyền “Bất kỳ ai có đường liên kết” và cho phép tải xuống để máy chủ đọc được tệp.

Với đề trắc nghiệm hoặc đề hỗn hợp, dán link tệp đáp án rồi bấm **Đọc đáp án**. Có thể dùng PDF có lớp văn bản (gồm bảng của đề số 9), TXT UTF-8 mỗi đáp án một dòng, hoặc CSV hai cột với tiêu đề “Câu,Đáp án”. Ví dụ, bốn dòng A, ĐSSĐ, 70,6 và TL tạo bốn câu theo đúng thứ tự. TL mở phần gửi ảnh. Đối chiếu số câu, sửa đáp án trong ô xem trước nếu cần rồi đăng đề. Với đề chỉ tự luận, chọn **Chỉ tự luận** và nhập số câu.

Học sinh xem PDF và điền phiếu trả lời trong hai khung cuộn riêng. Điện thoại dọc xếp đề phía trên và phiếu phía dưới. Có thể chụp ảnh hoặc chọn ảnh cho từng câu tự luận. Lời giải PDF hiện sau khi nộp. Đề chấm tự động trả điểm ngay. Với bài có câu tự luận, giáo viên vào **Chấm tự luận**, xem ảnh, nhập mức đạt và chọn **Duyệt và trả điểm**. Học sinh xem lại trong **Điểm của tôi**.