import jwt from "jsonwebtoken";
import { config } from "../config/config.js";
import User from "../models/User.js";

// Middleware xác thực JWT
export const authenticate = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        error: "Không có token xác thực",
      });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({
        error: "Token không hợp lệ",
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        error: "Tài khoản đã bị vô hiệu hóa",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Lỗi xác thực:", error);
    return res.status(401).json({
      error: "Token không hợp lệ",
    });
  }
};

// Middleware kiểm tra quyền admin
export const requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      error: "Bạn không có quyền truy cập",
    });
  }
  next();
};

// Middleware kiểm tra quyền editor hoặc admin
export const requireEditor = (req, res, next) => {
  if (!["admin", "editor"].includes(req.user.role)) {
    return res.status(403).json({
      error: "Bạn không có quyền truy cập",
    });
  }
  next();
};

// Middleware kiểm tra quyền author, editor hoặc admin
export const requireAuthor = (req, res, next) => {
  if (!["admin", "editor", "author"].includes(req.user.role)) {
    return res.status(403).json({
      error: "Bạn không có quyền truy cập",
    });
  }
  next();
};

// Middleware kiểm tra quyền sở hữu tài nguyên
export const requireOwnership = (req, res, next) => {
  const resourceUserId =
    req.params.userId || req.body.author || req.resource?.author;

  if (req.user.role === "admin") {
    return next(); // Admin có thể truy cập mọi thứ
  }

  if (req.user._id.toString() !== resourceUserId?.toString()) {
    return res.status(403).json({
      error: "Bạn chỉ có thể truy cập tài nguyên của mình",
    });
  }

  next();
};
