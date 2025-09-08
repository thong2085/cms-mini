# 🚀 Hướng dẫn Setup Backend CMS Mini

## Bước 1: Cài đặt Dependencies

```bash
cd backend
npm install
```

## Bước 2: Cấu hình Environment

Tạo file `.env` trong thư mục `backend/`:

```env
# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/cms-mini

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Admin User (for initial setup)
ADMIN_EMAIL=admin@cms-mini.com
ADMIN_PASSWORD=admin123
```

## Bước 3: Khởi động MongoDB

Đảm bảo MongoDB đang chạy trên máy của bạn:

```bash
# Windows (nếu cài đặt MongoDB service)
net start MongoDB

# Hoặc chạy MongoDB manually
mongod
```

## Bước 4: Khởi tạo Admin User

```bash
npm run init-admin
```

## Bước 5: Chạy Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

## ✅ Kiểm tra Setup

1. Server chạy tại: http://localhost:5000
2. Health check: http://localhost:5000/api/health
3. API docs: Xem README.md

## 🔑 Thông tin Admin

- **Email**: admin@cms-mini.com
- **Password**: admin123

⚠️ **Quan trọng**: Đổi mật khẩu admin sau khi đăng nhập lần đầu!

## 🐛 Troubleshooting

### Lỗi kết nối MongoDB

- Kiểm tra MongoDB có đang chạy không
- Kiểm tra MONGODB_URI trong .env
- Kiểm tra port MongoDB (mặc định 27017)

### Lỗi JWT

- Kiểm tra JWT_SECRET trong .env
- Đảm bảo JWT_SECRET không để trống

### Lỗi CORS

- Kiểm tra FRONTEND_URL trong .env
- Đảm bảo frontend đang chạy trên port đúng

## 📞 Hỗ trợ

Nếu gặp vấn đề, hãy kiểm tra:

1. Logs trong terminal
2. MongoDB connection
3. Environment variables
4. Port conflicts
