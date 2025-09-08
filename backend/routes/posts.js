import express from "express";
import { body, validationResult, query } from "express-validator";
import Post from "../models/Post.js";
import Category from "../models/Category.js";
import {
  authenticate,
  requireAuthor,
  requireOwnership,
} from "../middleware/auth.js";
import { uploadSingle } from "../middleware/upload.js";

const router = express.Router();

// Lấy danh sách posts
router.get(
  "/",
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
    query("category")
      .optional()
      .isMongoId()
      .withMessage("Category ID không hợp lệ"),
    query("author")
      .optional()
      .isMongoId()
      .withMessage("Author ID không hợp lệ"),
    query("status")
      .optional()
      .isIn(["draft", "published", "archived"])
      .withMessage("Status không hợp lệ"),
    query("featured")
      .optional()
      .isBoolean()
      .withMessage("Featured phải là boolean"),
    query("sort")
      .optional()
      .isIn(["newest", "oldest", "popular", "title"])
      .withMessage("Sort không hợp lệ"),
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
      const category = req.query.category || "";
      const author = req.query.author || "";
      const status = req.query.status || "";
      const featured = req.query.featured;
      const sort = req.query.sort || "newest";
      const skip = (page - 1) * limit;

      // Xây dựng filter
      const filter = {};

      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: "i" } },
          { content: { $regex: search, $options: "i" } },
          { excerpt: { $regex: search, $options: "i" } },
        ];
      }

      if (category) {
        filter.categories = category;
      }

      if (author) {
        filter.author = author;
      }

      if (status) {
        filter.status = status;
      } else {
        // Mặc định chỉ hiển thị published posts cho public
        if (!req.user || req.user.role === "user") {
          filter.status = "published";
        }
      }

      if (featured !== undefined) {
        filter.isFeatured = featured === "true";
      }

      // Xây dựng sort
      let sortOption = {};
      switch (sort) {
        case "newest":
          sortOption = { publishedAt: -1, createdAt: -1 };
          break;
        case "oldest":
          sortOption = { publishedAt: 1, createdAt: 1 };
          break;
        case "popular":
          sortOption = { views: -1, likes: -1 };
          break;
        case "title":
          sortOption = { title: 1 };
          break;
        default:
          sortOption = { publishedAt: -1, createdAt: -1 };
      }

      // Query posts
      const posts = await Post.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limit);

      const total = await Post.countDocuments(filter);

      res.json({
        posts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Lỗi lấy danh sách posts:", error);
      res.status(500).json({
        error: "Có lỗi xảy ra khi lấy danh sách posts",
      });
    }
  }
);

// Lấy post theo slug
router.get("/slug/:slug", async (req, res) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug });

    if (!post) {
      return res.status(404).json({
        error: "Không tìm thấy bài viết",
      });
    }

    // Kiểm tra quyền xem draft
    if (post.status === "draft" && (!req.user || req.user.role === "user")) {
      return res.status(403).json({
        error: "Bạn không có quyền xem bài viết này",
      });
    }

    // Tăng view count
    post.views += 1;
    await post.save();

    res.json({ post });
  } catch (error) {
    console.error("Lỗi lấy post:", error);
    res.status(500).json({
      error: "Có lỗi xảy ra khi lấy bài viết",
    });
  }
});

// Lấy post theo ID
router.get("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        error: "Không tìm thấy bài viết",
      });
    }

    // Kiểm tra quyền xem draft
    if (post.status === "draft" && (!req.user || req.user.role === "user")) {
      return res.status(403).json({
        error: "Bạn không có quyền xem bài viết này",
      });
    }

    res.json({ post });
  } catch (error) {
    console.error("Lỗi lấy post:", error);
    res.status(500).json({
      error: "Có lỗi xảy ra khi lấy bài viết",
    });
  }
});

// Tạo post mới (chỉ author/editor/admin)
router.post(
  "/",
  authenticate,
  requireAuthor,
  [
    body("title")
      .isLength({ min: 1, max: 200 })
      .withMessage("Tiêu đề phải có từ 1-200 ký tự")
      .trim(),
    body("content").isLength({ min: 1 }).withMessage("Nội dung là bắt buộc"),
    body("excerpt")
      .optional()
      .isLength({ max: 300 })
      .withMessage("Tóm tắt không được quá 300 ký tự"),
    body("categories")
      .optional()
      .isArray()
      .withMessage("Categories phải là array"),
    body("categories.*")
      .optional()
      .isMongoId()
      .withMessage("Category ID không hợp lệ"),
    body("tags").optional().isArray().withMessage("Tags phải là array"),
    body("tags.*")
      .optional()
      .isLength({ max: 50 })
      .withMessage("Tag không được quá 50 ký tự"),
    body("status")
      .optional()
      .isIn(["draft", "published", "archived"])
      .withMessage("Status không hợp lệ"),
    body("isFeatured")
      .optional()
      .isBoolean()
      .withMessage("isFeatured phải là boolean"),
    body("allowComments")
      .optional()
      .isBoolean()
      .withMessage("allowComments phải là boolean"),
    body("seoTitle")
      .optional()
      .isLength({ max: 60 })
      .withMessage("SEO title không được quá 60 ký tự"),
    body("seoDescription")
      .optional()
      .isLength({ max: 160 })
      .withMessage("SEO description không được quá 160 ký tự"),
    body("seoKeywords")
      .optional()
      .isArray()
      .withMessage("SEO keywords phải là array"),
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

      const {
        title,
        content,
        excerpt,
        categories = [],
        tags = [],
        status = "draft",
        isFeatured = false,
        allowComments = true,
        seoTitle,
        seoDescription,
        seoKeywords = [],
      } = req.body;

      // Kiểm tra categories tồn tại
      if (categories.length > 0) {
        const existingCategories = await Category.countDocuments({
          _id: { $in: categories },
          isActive: true,
        });

        if (existingCategories !== categories.length) {
          return res.status(400).json({
            error: "Một hoặc nhiều category không tồn tại",
          });
        }
      }

      const post = new Post({
        title,
        content,
        excerpt,
        categories,
        tags: tags.map((tag) => tag.toLowerCase().trim()),
        status,
        isFeatured,
        allowComments,
        seoTitle,
        seoDescription,
        seoKeywords,
        author: req.user._id,
      });

      await post.save();

      res.status(201).json({
        message: "Tạo bài viết thành công",
        post,
      });
    } catch (error) {
      console.error("Lỗi tạo post:", error);
      res.status(500).json({
        error: "Có lỗi xảy ra khi tạo bài viết",
      });
    }
  }
);

// Cập nhật post
router.put(
  "/:id",
  authenticate,
  [
    body("title")
      .optional()
      .isLength({ min: 1, max: 200 })
      .withMessage("Tiêu đề phải có từ 1-200 ký tự")
      .trim(),
    body("content")
      .optional()
      .isLength({ min: 1 })
      .withMessage("Nội dung không được để trống"),
    body("excerpt")
      .optional()
      .isLength({ max: 300 })
      .withMessage("Tóm tắt không được quá 300 ký tự"),
    body("categories")
      .optional()
      .isArray()
      .withMessage("Categories phải là array"),
    body("categories.*")
      .optional()
      .isMongoId()
      .withMessage("Category ID không hợp lệ"),
    body("tags").optional().isArray().withMessage("Tags phải là array"),
    body("tags.*")
      .optional()
      .isLength({ max: 50 })
      .withMessage("Tag không được quá 50 ký tự"),
    body("status")
      .optional()
      .isIn(["draft", "published", "archived"])
      .withMessage("Status không hợp lệ"),
    body("isFeatured")
      .optional()
      .isBoolean()
      .withMessage("isFeatured phải là boolean"),
    body("allowComments")
      .optional()
      .isBoolean()
      .withMessage("allowComments phải là boolean"),
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

      const post = await Post.findById(req.params.id);
      if (!post) {
        return res.status(404).json({
          error: "Không tìm thấy bài viết",
        });
      }

      // Kiểm tra quyền
      if (
        req.user.role !== "admin" &&
        req.user.role !== "editor" &&
        post.author.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          error: "Bạn không có quyền cập nhật bài viết này",
        });
      }

      const {
        title,
        content,
        excerpt,
        categories,
        tags,
        status,
        isFeatured,
        allowComments,
        seoTitle,
        seoDescription,
        seoKeywords,
      } = req.body;

      // Kiểm tra categories tồn tại
      if (categories && categories.length > 0) {
        const existingCategories = await Category.countDocuments({
          _id: { $in: categories },
          isActive: true,
        });

        if (existingCategories !== categories.length) {
          return res.status(400).json({
            error: "Một hoặc nhiều category không tồn tại",
          });
        }
      }

      // Cập nhật post
      const updates = {};
      if (title !== undefined) updates.title = title;
      if (content !== undefined) updates.content = content;
      if (excerpt !== undefined) updates.excerpt = excerpt;
      if (categories !== undefined) updates.categories = categories;
      if (tags !== undefined)
        updates.tags = tags.map((tag) => tag.toLowerCase().trim());
      if (status !== undefined) updates.status = status;
      if (isFeatured !== undefined) updates.isFeatured = isFeatured;
      if (allowComments !== undefined) updates.allowComments = allowComments;
      if (seoTitle !== undefined) updates.seoTitle = seoTitle;
      if (seoDescription !== undefined) updates.seoDescription = seoDescription;
      if (seoKeywords !== undefined) updates.seoKeywords = seoKeywords;

      const updatedPost = await Post.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true,
      });

      res.json({
        message: "Cập nhật bài viết thành công",
        post: updatedPost,
      });
    } catch (error) {
      console.error("Lỗi cập nhật post:", error);
      res.status(500).json({
        error: "Có lỗi xảy ra khi cập nhật bài viết",
      });
    }
  }
);

// Upload featured image
router.post(
  "/:id/featured-image",
  authenticate,
  uploadSingle("featuredImage"),
  async (req, res) => {
    try {
      const post = await Post.findById(req.params.id);
      if (!post) {
        return res.status(404).json({
          error: "Không tìm thấy bài viết",
        });
      }

      // Kiểm tra quyền
      if (
        req.user.role !== "admin" &&
        req.user.role !== "editor" &&
        post.author.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          error: "Bạn không có quyền cập nhật bài viết này",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "Không có file được upload",
        });
      }

      // Cập nhật featured image
      post.featuredImage = `/uploads/${req.file.filename}`;
      await post.save();

      res.json({
        message: "Upload featured image thành công",
        featuredImage: post.featuredImage,
      });
    } catch (error) {
      console.error("Lỗi upload featured image:", error);
      res.status(500).json({
        error: "Có lỗi xảy ra khi upload featured image",
      });
    }
  }
);

// Xóa post
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({
        error: "Không tìm thấy bài viết",
      });
    }

    // Kiểm tra quyền
    if (
      req.user.role !== "admin" &&
      req.user.role !== "editor" &&
      post.author.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        error: "Bạn không có quyền xóa bài viết này",
      });
    }

    await Post.findByIdAndDelete(req.params.id);

    res.json({
      message: "Xóa bài viết thành công",
    });
  } catch (error) {
    console.error("Lỗi xóa post:", error);
    res.status(500).json({
      error: "Có lỗi xảy ra khi xóa bài viết",
    });
  }
});

// Like/Unlike post
router.post("/:id/like", authenticate, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({
        error: "Không tìm thấy bài viết",
      });
    }

    // TODO: Implement like/unlike logic with user tracking
    post.likes += 1;
    await post.save();

    res.json({
      message: "Like bài viết thành công",
      likes: post.likes,
    });
  } catch (error) {
    console.error("Lỗi like post:", error);
    res.status(500).json({
      error: "Có lỗi xảy ra khi like bài viết",
    });
  }
});

// Lấy thống kê posts (chỉ admin/editor)
router.get("/stats/overview", authenticate, requireAuthor, async (req, res) => {
  try {
    const totalPosts = await Post.countDocuments();
    const publishedPosts = await Post.countDocuments({ status: "published" });
    const draftPosts = await Post.countDocuments({ status: "draft" });
    const archivedPosts = await Post.countDocuments({ status: "archived" });
    const featuredPosts = await Post.countDocuments({ isFeatured: true });

    // Posts mới trong 30 ngày qua
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newPosts = await Post.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Top posts theo views
    const topPosts = await Post.find({ status: "published" })
      .sort({ views: -1 })
      .limit(5)
      .select("title slug views likes publishedAt");

    res.json({
      totalPosts,
      publishedPosts,
      draftPosts,
      archivedPosts,
      featuredPosts,
      newPosts,
      topPosts,
    });
  } catch (error) {
    console.error("Lỗi lấy thống kê posts:", error);
    res.status(500).json({
      error: "Có lỗi xảy ra khi lấy thống kê posts",
    });
  }
});

export default router;
