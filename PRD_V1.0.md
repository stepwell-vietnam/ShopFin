TÀI LIỆU YÊU CẦU SẢN PHẨM (PRD) - SHOPFIN MVP (V1.0)
Dự án: ShopFin MVP Trọng tâm: Tự động hóa báo cáo từ tệp tin (File-based Automation). Mục tiêu: Giúp chủ shop xem nhanh lợi nhuận thực tế và đối soát dòng tiền mà không cần xử lý mapping SKU phức tạp.

1. Luồng dữ liệu đầu vào (Input Data)
Hệ thống xử lý 4 loại tệp báo cáo mặc định từ Shopee:


Báo cáo Thu nhập (PDF): Trích xuất tổng doanh thu sản phẩm (₫257.128.170), phí cố định (₫38.349.600), phí dịch vụ (₫12.533.757) và phí thanh toán (₫12.116.052).


Báo cáo Đơn hàng (CSV): Trích xuất mã đơn hàng, trạng thái đơn (Hoàn thành, Đã hủy) và tổng giá trị đơn hàng.


Báo cáo Sản phẩm (CSV): Lấy dữ liệu lượt truy cập, lượt xem trang và doanh số xác nhận theo ngày.

Báo cáo Giao dịch Ví (CSV): Lấy dữ liệu tiền vào thực tế (₫171.104.122) và chi phí nạp quảng cáo Shopee Ads (₫8.856.000).

2. Các chức năng chính (Core Features)
2.1. Chế độ Nhập liệu linh hoạt
Upload kéo thả: Khu vực tiếp nhận cùng lúc cả 4 file.

Auto-scan Folder: Tính năng cho phép người dùng chọn một thư mục "Downloads". Ứng dụng sẽ tự động phát hiện khi có file báo cáo Shopee mới được tải về và cập nhật Dashboard ngay lập tức.

2.2. Dashboard Báo cáo Tài chính (MVP Dashboard)
Hiển thị các chỉ số cốt lõi thu thập từ dữ liệu thực tế:


Tổng doanh số sản phẩm (Gross Revenue): Tổng giá trị bán ra trước phí.


Doanh thu thực nhận (Net Revenue): Số tiền thực tế Shopee đã hạch toán thành công về ví (₫171.011.604).


Chi tiết chi phí sàn: Bóc tách 3 loại phí chính (Cố định, Dịch vụ, Thanh toán) để người dùng thấy rõ tỷ lệ thất thoát doanh thu.


Chi phí quảng cáo thực chi: Tổng tiền nạp Ads cấn trừ trực tiếp từ số dư ví (₫8.856.000).

2.3. Báo cáo Doanh thu hằng ngày (Daily Performance)
Hệ thống tự động nối dữ liệu để tạo bảng so sánh hằng ngày:


GMV (Đơn đặt): Tổng giá trị khách bấm đặt hàng.


Doanh số xác nhận: Giá trị đơn thực tế đã qua khâu xác nhận/đóng gói.


Tiền về ví: Dòng tiền thực tế đổ vào tài khoản Shopee hằng ngày.

2.4. Module Đối soát dòng tiền (Cashflow Audit)

Tính hợp lý dòng tiền: Cảnh báo nếu có sự chênh lệch giữa số tiền dự kiến trong báo cáo thu nhập (₫171.011.604) và số tiền vào ví thực tế (₫171.104.122).

Tiền "treo": Hiển thị tổng giá trị các đơn hàng ở trạng thái "Hoàn thành" nhưng tiền chưa xuất hiện trong giao dịch ví.

3. Công thức Logic MVP
Hệ thống sẽ thực hiện các phép tính tự động sau:

Tỷ lệ phí sàn/Doanh thu: (Tổng phí sàn / Tổng doanh số sản phẩm) * 100. (Dựa trên dữ liệu của bạn, con số này đang ở mức ~28%) .

ROAS thực tế: Tiền thực về ví / Chi phí nạp Ads (từ Ví).


Tỷ lệ hủy đơn: (Số đơn hủy / Tổng số đơn đặt) * 100.

4. Yêu cầu kỹ thuật đơn giản
Nền tảng: Ứng dụng Web (React/Next.js).

Xử lý: Bộ giải mã (Parser) viết bằng Rust/WASM để đọc nội dung PDF báo cáo thu nhập và CSV giao dịch ví ngay tại trình duyệt.

Lưu trữ: Chỉ sử dụng bộ nhớ tạm (Session Storage) trong phiên làm việc. Khi người dùng đóng trình duyệt, dữ liệu sẽ không được lưu lại để đảm bảo tính riêng tư tuyệt đối (do bản MVP chưa có mapping sản phẩm lâu dài).

5. Lợi ích của MVP này dành cho Gen
Xây dựng nhanh: Tập trung hoàn toàn vào việc đọc file và hiển thị số liệu, không cần lo khâu quản lý database sản phẩm.


Giá trị tức thì: Chỉ sau 1 lần upload, bạn biết ngay shop đang chi bao nhiêu tiền cho phí sàn và quảng cáo, đồng thời biết chính xác ngày nào tiền về ví nhiều nhất.