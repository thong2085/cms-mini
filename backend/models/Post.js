import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Tiêu đề bài viết là bắt buộc"],
      trim: true,
      maxlength: [200, "Tiêu đề không được quá 200 ký tự"],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    excerpt: {
      type: String,
      maxlength: [300, "Tóm tắt không được quá 300 ký tự"],
    },
    content: {
      type: String,
      required: [true, "Nội dung bài viết là bắt buộc"],
    },
    featuredImage: {
      type: String,
      default: null,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Tác giả là bắt buộc"],
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    views: {
      type: Number,
      default: 0,
    },
    likes: {
      type: Number,
      default: 0,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    allowComments: {
      type: Boolean,
      default: true,
    },
    seoTitle: {
      type: String,
      maxlength: [60, "SEO title không được quá 60 ký tự"],
    },
    seoDescription: {
      type: String,
      maxlength: [160, "SEO description không được quá 160 ký tự"],
    },
    seoKeywords: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Tạo slug từ title trước khi lưu
postSchema.pre("save", function (next) {
  if (this.isModified("title")) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim("-");
  }

  // Tự động set publishedAt khi status = published
  if (
    this.isModified("status") &&
    this.status === "published" &&
    !this.publishedAt
  ) {
    this.publishedAt = new Date();
  }

  next();
});

// Index cho tìm kiếm
postSchema.index({ title: "text", content: "text", excerpt: "text" });
postSchema.index({ slug: 1 });
postSchema.index({ author: 1 });
postSchema.index({ categories: 1 });
postSchema.index({ status: 1 });
postSchema.index({ publishedAt: -1 });
postSchema.index({ isFeatured: 1 });
postSchema.index({ views: -1 });

// Virtual cho URL
postSchema.virtual("url").get(function () {
  return `/posts/${this.slug}`;
});

// Populate author và categories khi query
postSchema.pre(/^find/, function (next) {
  this.populate("author", "username fullName avatar").populate(
    "categories",
    "name slug color"
  );
  next();
});

export default mongoose.model("Post", postSchema);
