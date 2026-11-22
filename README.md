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

## 3. Mẫu dùng chung

Quản trị → Mẫu dùng chung. Ban đầu website dùng ảnh Conan, Agasa và quy ước của PackageForDayThemVatLy12.sty được đóng gói trong bản triển khai. Chọn tệp mới để thay thế ngay tại cùng một vị trí. Nút Xóa tắt thành phần đó; chọn tệp mới để bật lại. Hai ảnh tải lên được thu nhỏ trước khi lưu. Với mẫu tùy chỉnh web lưu một bản mã .sty và một ảnh cho mỗi vai trò. Các đề dùng mẫu hiện hành khi mở. Nội dung đã biên dịch bên trong PDF Drive vẫn thuộc file PDF gốc.

## 4. Lời giải và điểm cá nhân

Ở Quản trị → Tạo đề và tài liệu, nhập đề rồi chọn file .tex lời giải hoặc dán nội dung vào ô Lời giải theo câu. Bấm Xem thử để kiểm tra từng câu trước khi đăng. Bộ đọc hỗ trợ các khối hdg/khung trong mẫu Đề 09, lệnh loigiai và văn bản đánh số liên tiếp “Câu 1: …”. Số lời giải phải bằng số câu, thứ tự theo thứ tự của đề. Có thể để trống nếu chưa có lời giải. Công thức dùng KaTeX/MathML. Các lệnh trình bày tài liệu hoặc hình TikZ tùy biến cần bản PDF đã biên dịch để giữ nguyên thiết kế.

Học sinh xem Xem lời giải sau khi nộp, hoặc chọn Điểm của tôi để mở lại kết quả từng lượt. Bài tập/đề thi và kiểm tra định kì có hai thẻ riêng. Máy chủ lấy mã học sinh từ phiên đăng nhập để xác định chủ bài làm. Quản trị viên xem báo cáo điểm trong trang Quản trị.

## Chạy thử cục bộ

Chạy npm test để kiểm tra mã. Muốn chạy web trên máy để thử trước khi triển khai, đặt BOOTSTRAP_ADMIN_CODE trong môi trường của terminal rồi chạy npm start. Máy chủ cục bộ dùng dữ liệu riêng trong .local, ngoài thư mục public.


## Nếu trang đăng nhập báo lỗi
Mã 83917 thuộc bản trải nghiệm ngoại tuyến. Với database mới, dùng mã riêng trong BOOTSTRAP_ADMIN_CODE. Với database đã có tài khoản, dùng mã quản trị đã cấp khi khởi tạo.

Nếu bản cũ báo “Không xử lý được yêu cầu. Kiểm tra cấu hình máy chủ.”, kiểm tra ba biến môi trường phía trên tại đúng site và ngữ cảnh deploy. Đặc biệt, biến tài khoản dịch vụ phải là JSON có private_key, khác với cấu hình Firebase Web App có apiKey. Bản sửa hiển thị thông tin cụ thể cho cấu hình thiếu hoặc sai định dạng. Khi nhận mã tra cứu, tìm chuỗi đó trong Logs → Functions → school để xem mã lỗi kỹ thuật; log chẩn đoán không ghi nội dung khóa hoặc mã đăng nhập. Áp dụng các thay đổi cấu hình trong cùng lượt deploy bản sửa.

## Dán đề và đáp án trực tiếp
Chọn “Dán TeX đề + TeX đáp án”. Dán đề và bảng đáp án vào hai ô, bấm Đọc và kiểm tra rồi đăng. Dạng văn bản A–D, mẫu cauhoi/phuongan/task, bangdungsai/phatbieuDS và cautlngan được nhận diện. Khi giáo viên bấm Đọc và kiểm tra, Netlify Function biên dịch từng tikzpicture bằng node-tikzjax. Thư viện TikZ có thể khai báo bằng usetikzlibrary trong đề. Hình SVG được lưu cùng đề và hiển thị qua thẻ ảnh. Macro tự định nghĩa bên ngoài khối hình hoặc package ngoài bộ hỗ trợ có thể cần điều chỉnh. Máy chủ giữ khóa đáp án và trả kết quả sau khi nộp.

