# PostgreSQL MCP Server 🐘

[English](README.md) | [Tiếng Việt](README.vi.md)

Một **Model Context Protocol (MCP)** server mạnh mẽ dành cho cơ sở dữ liệu PostgreSQL. Server này cho phép các trợ lý AI (như Claude, Antigravity, hoặc các extension VS Code) tương tác an toàn với dữ liệu của bạn, thực hiện truy vấn và kiểm tra cấu trúc bảng.

## 🌟 Tính năng

- **Truy cập Database Trực tiếp**: Kết nối đến bất kỳ database PostgreSQL nào qua chuỗi kết nối (connection string).
- **Kiểm tra Schema**: Dễ dàng xem danh sách bảng, cột, ràng buộc (constraints) và index.
- **Tìm kiếm Toàn văn**: Tìm kiếm nội dung văn bản trong tất cả các cột của bảng.
- **Phân tích Hiệu năng**: Chạy lệnh `EXPLAIN` để xem kế hoạch thực thi truy vấn.
- **An toàn**: Tách biệt rõ ràng giữa công cụ đọc (`SELECT`) và công cụ ghi/sửa đổi.

## 🛠️ Danh sách Công cụ (Tools)

| Công cụ                  | Mô tả                                                                     |
| ------------------------ | ------------------------------------------------------------------------- |
| `list_tables`            | Liệt kê tất cả các bảng trong schema `public`.                            |
| `describe_table`         | Xem chi tiết cấu trúc (cột, kiểu dữ liệu, giá trị mặc định) của một bảng. |
| `list_indexes`           | Xem danh sách các index của một bảng cụ thể.                              |
| `list_constraints`       | Xem Khóa chính (PK), Khóa ngoại (FK) và các ràng buộc khác.               |
| `search_in_table`        | Tìm kiếm chuỗi văn bản trong bất kỳ cột text nào của bảng.                |
| `run_read_only_query`    | Thực thi truy vấn `SELECT` an toàn. Chặn các lệnh sửa đổi dữ liệu.        |
| `run_modification_query` | Thực thi lệnh `INSERT`, `UPDATE`, `DELETE`, `CREATE`.                     |
| `explain_query`          | Lấy kế hoạch thực thi (JSON plan) để tối ưu hóa hiệu năng.                |

## 🚀 Cài đặt & Thiết lập

### 1. Yêu cầu

- Node.js (v18 trở lên)
- Một database PostgreSQL đang hoạt động

### 2. Cài đặt

Clone repository này và cài đặt các thư viện phụ thuộc:

```bash
git clone <your-repo-url>
cd mcp-postgre-server
npm install
```

### 3. Cấu hình (.env)

Tạo file `.env` tại thư mục gốc để lưu thông tin kết nối.
**Quan trọng**: Không bao giờ đưa file `.env` chứa mật khẩu thật lên Git.

```bash
cp .env.example .env
```

Chỉnh sửa file `.env` và điền `DATABASE_URL` của bạn:

```env
# Định dạng: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DATABASE_URL=postgresql://myuser:mypassword@localhost:5432/mydatabase
```

### 4. Build (Biên dịch)

Biên dịch mã nguồn TypeScript sang JavaScript:

```bash
npm run build
```

## 🔌 Kết nối với Client

### VS Code (Claude / MCP Extension) & Antigravity

Để sử dụng server này, bạn cần thêm cấu hình vào file cài đặt MCP của công cụ bạn đang dùng (ví dụ `mcp_config.json` hoặc setting của VS Code).

**Đường dẫn Config (Ví dụ):**

- Windows (VS Code): `%APPDATA%\Code\User\globalStorage\mcp-server\mcp_settings.json` (tùy extension)
- Antigravity: `c:\Users\<User>\.gemini\antigravity\mcp_config.json`

**Mẫu Cấu hình JSON:**

```json
{
  "mcpServers": {
    "postgre-server": {
      "command": "node",
      "args": ["D:\\Path\\To\\mcp-postgre-server\\build\\index.js"],
      "env": {
        "DATABASE_URL": "postgresql://myuser:mypassword@localhost:5432/mydatabase"
      }
    }
  }
}
```

> **Lưu ý**: Bạn có thể đặt `DATABASE_URL` trong file `.env` (nếu chạy server từ đúng thư mục gốc) hoặc điền trực tiếp vào phần `env` trong file config JSON như trên để chắc chắn nhận diện đúng.

## 🔒 Bảo mật

- **Chế độ Chỉ Đọc**: Công cụ `run_read_only_query` có cơ chế kiểm tra cơ bản để chặn các từ khóa `INSERT/UPDATE/DELETE`.
- **Làm sạch đầu vào**: Tên bảng được kiểm tra hợp lệ trong các công cụ tìm kiếm để tránh lỗi SQL Injection.

## 📜 Giấy phép
