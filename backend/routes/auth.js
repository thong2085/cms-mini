import express from "express";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import { config } from "../config/config.js";
import User from "../models/User.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Đăng ký
router.post(
  "/register",
  [
    body("username")
      .isLength({ min: 3, max: 30 })
      .withMessage("Tên người dùng phải có từ 3-30 ký tự")
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage("Tên người dùng chỉ được chứa chữ cái, số và dấu gạch dưới"),
    body("email").isEmail().withMessage("Email không hợp lệ").normalizeEmail(),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Mật khẩu phải có ít nhất 6 ký tự"),
    body("fullName")
      .isLength({ min: 2, max: 100 })
      .withMessage("Họ tên phải có từ 2-100 ký tự")
      .trim(),
  ],
  async (req, res) => {
    try {
      // Kiểm tra validation
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Dữ liệu không hợp lệ",
          details: errors.array(),
        });
      }

      const { username, email, password, fullName } = req.body;

      // Kiểm tra user đã tồn tại
      const existingUser = await User.findOne({
        $or: [{ email }, { username }],
      });

      if (existingUser) {
        return res.status(400).json({
          error:
            existingUser.email === email
              ? "Email đã được sử dụng"
              : "Tên người dùng đã được sử dụng",
        });
      }

      // Tạo user mới
      const user = new User({
        username,
        email,
        password,
        fullName,
      });

      await user.save();

      // Tạo JWT token
      const token = jwt.sign({ userId: user._id }, config.JWT_SECRET, {
        expiresIn: config.JWT_EXPIRE,
      });

      res.status(201).json({
        message: "Đăng ký thành công",
        token,
        user: user.toJSON(),
      });
    } catch (error) {
      console.error("Lỗi đăng ký:", error);
      res.status(500).json({
        error: "Có lỗi xảy ra khi đăng ký",
      });
    }
  }
);

// Đăng nhập
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Email không hợp lệ").normalizeEmail(),
    body("password").notEmpty().withMessage("Mật khẩu là bắt buộc"),
  ],
  async (req, res) => {
    try {
      // Kiểm tra validation
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Dữ liệu không hợp lệ",
          details: errors.array(),
        });
      }

      const { email, password } = req.body;

      // Tìm user
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({
          error: "Email hoặc mật khẩu không đúng",
        });
      }

      // Kiểm tra tài khoản có bị vô hiệu hóa
      if (!user.isActive) {
        return res.status(401).json({
          error: "Tài khoản đã bị vô hiệu hóa",
        });
      }

      // Kiểm tra mật khẩu
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          error: "Email hoặc mật khẩu không đúng",
        });
      }

      // Tạo JWT token
      const token = jwt.sign({ userId: user._id }, config.JWT_SECRET, {
        expiresIn: config.JWT_EXPIRE,
      });

      res.json({
        message: "Đăng nhập thành công",
        token,
        user: user.toJSON(),
      });
    } catch (error) {
      console.error("Lỗi đăng nhập:", error);
      res.status(500).json({
        error: "Có lỗi xảy ra khi đăng nhập",
      });
    }
  }
);

// Lấy thông tin user hiện tại
router.get("/me", authenticate, async (req, res) => {
  try {
    res.json({
      user: req.user,
    });
  } catch (error) {
    console.error("Lỗi lấy thông tin user:", error);
    res.status(500).json({
      error: "Có lỗi xảy ra khi lấy thông tin user",
    });
  }
});

// Cập nhật profile
router.put(
  "/profile",
  authenticate,
  [
    body("fullName")
      .optional()
      .isLength({ min: 2, max: 100 })
      .withMessage("Họ tên phải có từ 2-100 ký tự")
      .trim(),
    body("bio")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Tiểu sử không được quá 500 ký tự"),
    body("socialLinks.website")
      .optional()
      .isURL()
      .withMessage("Website không hợp lệ"),
    body("socialLinks.twitter")
      .optional()
      .isURL()
      .withMessage("Twitter không hợp lệ"),
    body("socialLinks.facebook")
      .optional()
      .isURL()
      .withMessage("Facebook không hợp lệ"),
    body("socialLinks.instagram")
      .optional()
      .isURL()
      .withMessage("Instagram không hợp lệ"),
    body("socialLinks.linkedin")
      .optional()
      .isURL()
      .withMessage("LinkedIn không hợp lệ"),
  ],
  async (req, res) => {
    try {
      // Kiểm tra validation
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Dữ liệu không hợp lệ",
          details: errors.array(),
        });
      }

      const allowedUpdates = ["fullName", "bio", "socialLinks"];
      const updates = {};

      allowedUpdates.forEach((field) => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });

      const user = await User.findByIdAndUpdate(req.user._id, updates, {
        new: true,
        runValidators: true,
      });

      res.json({
        message: "Cập nhật profile thành công",
        user: user.toJSON(),
      });
    } catch (error) {
      console.error("Lỗi cập nhật profile:", error);
      res.status(500).json({
        error: "Có lỗi xảy ra khi cập nhật profile",
      });
    }
  }
);

// Đổi mật khẩu
router.put(
  "/change-password",
  authenticate,
  [
    body("currentPassword")
      .notEmpty()
      .withMessage("Mật khẩu hiện tại là bắt buộc"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("Mật khẩu mới phải có ít nhất 6 ký tự"),
  ],
  async (req, res) => {
    try {
      // Kiểm tra validation
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Dữ liệu không hợp lệ",
          details: errors.array(),
        });
      }

      const { currentPassword, newPassword } = req.body;

      // Lấy user với password
      const user = await User.findById(req.user._id);

      // Kiểm tra mật khẩu hiện tại
      const isCurrentPasswordValid = await user.comparePassword(
        currentPassword
      );
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          error: "Mật khẩu hiện tại không đúng",
        });
      }

      // Cập nhật mật khẩu mới
      user.password = newPassword;
      await user.save();

      res.json({
        message: "Đổi mật khẩu thành công",
      });
    } catch (error) {
      console.error("Lỗi đổi mật khẩu:", error);
      res.status(500).json({
        error: "Có lỗi xảy ra khi đổi mật khẩu",
      });
    }
  }
);

export default router;
