import multer from "multer";
import path from "path";
import fs from "fs";
import { config } from "../config/config.js";

// Tạo thư mục uploads nếu chưa tồn tại
const uploadDir = config.UPLOAD_PATH;
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Cấu hình storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Tạo tên file unique
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

// Filter file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(
      new Error("Chỉ cho phép upload file hình ảnh (JPEG, PNG, GIF, WebP, SVG)")
    );
  }
};

// Cấu hình multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.MAX_FILE_SIZE,
  },
  fileFilter: fileFilter,
});

// Middleware upload single file
export const uploadSingle = (fieldName) => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
              error: `File quá lớn. Kích thước tối đa là ${
                config.MAX_FILE_SIZE / 1024 / 1024
              }MB`,
            });
          }
        }
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  };
};

// Middleware upload multiple files
export const uploadMultiple = (fieldName, maxCount = 5) => {
  return (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
              error: `File quá lớn. Kích thước tối đa là ${
                config.MAX_FILE_SIZE / 1024 / 1024
              }MB`,
            });
          }
          if (err.code === "LIMIT_FILE_COUNT") {
            return res.status(400).json({
              error: `Quá nhiều file. Tối đa ${maxCount} file`,
            });
          }
        }
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  };
};

// Middleware xử lý lỗi upload
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: `File quá lớn. Kích thước tối đa là ${
          config.MAX_FILE_SIZE / 1024 / 1024
        }MB`,
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        error: "Quá nhiều file được upload",
      });
    }
  }
  next(err);
};
