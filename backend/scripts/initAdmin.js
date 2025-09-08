import mongoose from "mongoose";
import User from "../models/User.js";
import { config } from "../config/config.js";

const initAdmin = async () => {
  try {
    // Kết nối database
    await mongoose.connect(config.MONGODB_URI);
    console.log("✅ Kết nối MongoDB thành công");

    // Kiểm tra admin đã tồn tại chưa
    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      console.log("ℹ️  Admin user đã tồn tại:", existingAdmin.email);
      return;
    }

    // Tạo admin user
    const adminUser = new User({
      username: "admin",
      email: config.ADMIN_EMAIL,
      password: config.ADMIN_PASSWORD,
      fullName: "Administrator",
      role: "admin",
      isActive: true,
    });

    await adminUser.save();
    console.log("✅ Tạo admin user thành công:");
    console.log(`   Email: ${config.ADMIN_EMAIL}`);
    console.log(`   Password: ${config.ADMIN_PASSWORD}`);
    console.log("⚠️  Hãy đổi mật khẩu sau khi đăng nhập lần đầu!");
  } catch (error) {
    console.error("❌ Lỗi khởi tạo admin:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Đã ngắt kết nối database");
  }
};

// Chạy script
initAdmin();
