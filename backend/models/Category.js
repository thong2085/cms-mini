import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên danh mục là bắt buộc"],
      unique: true,
      trim: true,
      maxlength: [50, "Tên danh mục không được quá 50 ký tự"],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      maxlength: [200, "Mô tả không được quá 200 ký tự"],
    },
    color: {
      type: String,
      default: "#3B82F6",
      match: [/^#[0-9A-F]{6}$/i, "Màu sắc phải là mã hex hợp lệ"],
    },
    icon: {
      type: String,
      default: "folder",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Tạo slug từ name trước khi lưu
categorySchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim("-");
  }
  next();
});

// Index cho tìm kiếm
categorySchema.index({ name: "text", description: "text" });
categorySchema.index({ slug: 1 });
categorySchema.index({ parent: 1 });

export default mongoose.model("Category", categorySchema);
