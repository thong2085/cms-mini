import express from "express";
import { body, validationResult, query } from "express-validator";
import User from "../models/User.js";
import {
  authenticate,
  requireAdmin,
  requireOwnership,
} from "../middleware/auth.js";
import { uploadSingle } from "../middleware/upload.js";

const router = express.Router();

// Lấy danh sách users (chỉ admin)
router.get(
  "/",
  authenticate,
  requireAdmin,
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Trang phải là số nguyên dương"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit phải từ 1-100"),
    query("search")
      .optional()
      .isLength({ max: 100 })
      .withMessage("Từ khóa tìm kiếm quá dài"),
    query("role")
      .optional()
      .isIn(["admin", "editor", "author", "user"])
      .withMessage("Role không hợp lệ"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Dữ liệu không hợp lệ",
          details: errors.array(),
        });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || "";
      const role = req.query.role || "";
      const skip = (page - 1) * limit;

      // Xây dựng filter
      const filter = {};

      if (search) {
        filter.$or = [
          { username: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { fullName: { $regex: search, $options: "i" } },
        ];
      }

      if (role) {
        filter.role = role;
      }

      // Query users
      const users = await User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await User.countDocuments(filter);

      res.json({
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Lỗi lấy danh sách users:", error);
      res.status(500).json({
        error: "Có lỗi xảy ra khi lấy danh sách users",
      });
    }
  }
);

// Lấy thông tin user theo ID
router.get("/:id", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({
        error: "Không tìm thấy user",
      });
    }

    res.json({ user });
  } catch (error) {
    console.error("Lỗi lấy thông tin user:", error);
    res.status(500).json({
      error: "Có lỗi xảy ra khi lấy thông tin user",
    });
  }
});

// Cập nhật thông tin user (chỉ admin hoặc chính user đó)
router.put(
  "/:id",
  authenticate,
  [
    body("fullName")
      .optional()
      .isLength({ min: 2, max: 100 })
      .withMessage("Họ tên phải có từ 2-100 ký tự")
      .trim(),
    body("role")
      .optional()
      .isIn(["admin", "editor", "author", "user"])
      .withMessage("Role không hợp lệ"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive phải là boolean"),
    body("bio")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Tiểu sử không được quá 500 ký tự"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Dữ liệu không hợp lệ",
          details: errors.array(),
        });
      }

      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({
          error: "Không tìm thấy user",
        });
      }

      // Kiểm tra quyền
      if (
        req.user.role !== "admin" &&
        req.user._id.toString() !== req.params.id
      ) {
        return res.status(403).json({
          error: "Bạn không có quyền cập nhật user này",
        });
      }

      // Chỉ admin mới có thể thay đổi role và isActive
      const allowedUpdates = ["fullName", "bio"];
      if (req.user.role === "admin") {
        allowedUpdates.push("role", "isActive");
      }

      const updates = {};
      allowedUpdates.forEach((field) => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });

      const updatedUser = await User.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true,
      }).select("-password");

      res.json({
        message: "Cập nhật user thành công",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Lỗi cập nhật user:", error);
      res.status(500).json({
        error: "Có lỗi xảy ra khi cập nhật user",
      });
    }
  }
);

// Upload avatar
router.post(
  "/:id/avatar",
  authenticate,
  uploadSingle("avatar"),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({
          error: "Không tìm thấy user",
        });
      }

      // Kiểm tra quyền
      if (
        req.user.role !== "admin" &&
        req.user._id.toString() !== req.params.id
      ) {
        return res.status(403).json({
          error: "Bạn không có quyền cập nhật avatar của user này",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "Không có file được upload",
        });
      }

      // Cập nhật avatar
      user.avatar = `/uploads/${req.file.filename}`;
      await user.save();

      res.json({
        message: "Upload avatar thành công",
        avatar: user.avatar,
      });
    } catch (error) {
      console.error("Lỗi upload avatar:", error);
      res.status(500).json({
        error: "Có lỗi xảy ra khi upload avatar",
      });
    }
  }
);

// Xóa user (chỉ admin)
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        error: "Không tìm thấy user",
      });
    }

    // Không cho phép xóa chính mình
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({
        error: "Không thể xóa chính mình",
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      message: "Xóa user thành công",
    });
  } catch (error) {
    console.error("Lỗi xóa user:", error);
    res.status(500).json({
      error: "Có lỗi xảy ra khi xóa user",
    });
  }
});

// Lấy thống kê users (chỉ admin)
router.get("/stats/overview", authenticate, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const adminUsers = await User.countDocuments({ role: "admin" });
    const editorUsers = await User.countDocuments({ role: "editor" });
    const authorUsers = await User.countDocuments({ role: "author" });
    const regularUsers = await User.countDocuments({ role: "user" });

    // Users mới trong 30 ngày qua
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newUsers = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    res.json({
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      newUsers,
      byRole: {
        admin: adminUsers,
        editor: editorUsers,
        author: authorUsers,
        user: regularUsers,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy thống kê users:", error);
    res.status(500).json({
      error: "Có lỗi xảy ra khi lấy thống kê users",
    });
  }
});

export default router;
