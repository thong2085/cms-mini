import express from "express";
import { body, validationResult, query } from "express-validator";
import Category from "../models/Category.js";
import {
  authenticate,
  requireAdmin,
  requireEditor,
} from "../middleware/auth.js";

const router = express.Router();

// Lấy danh sách categories
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
    query("parent")
      .optional()
      .isMongoId()
      .withMessage("Parent ID không hợp lệ"),
    query("active")
      .optional()
      .isBoolean()
      .withMessage("Active phải là boolean"),
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
      const parent = req.query.parent || "";
      const active = req.query.active;
      const skip = (page - 1) * limit;

      // Xây dựng filter
      const filter = {};

      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ];
      }

      if (parent !== "") {
        filter.parent = parent === "null" ? null : parent;
      }

      if (active !== undefined) {
        filter.isActive = active === "true";
      }

      // Query categories
      const categories = await Category.find(filter)
        .populate("parent", "name slug")
        .sort({ sortOrder: 1, name: 1 })
        .skip(skip)
        .limit(limit);

      const total = await Category.countDocuments(filter);

      res.json({
        categories,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Lỗi lấy danh sách categories:", error);
      res.status(500).json({
        error: "Có lỗi xảy ra khi lấy danh sách categories",
      });
    }
  }
);

// Lấy tất cả categories (không phân trang) - cho dropdown
router.get("/all", async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .populate("parent", "name slug")
      .sort({ sortOrder: 1, name: 1 })
      .select("name slug description color icon parent");

    res.json({ categories });
  } catch (error) {
    console.error("Lỗi lấy tất cả categories:", error);
    res.status(500).json({
      error: "Có lỗi xảy ra khi lấy categories",
    });
  }
});

// Lấy category theo ID
router.get("/:id", async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).populate(
      "parent",
      "name slug"
    );

    if (!category) {
      return res.status(404).json({
        error: "Không tìm thấy category",
      });
    }

    res.json({ category });
  } catch (error) {
    console.error("Lỗi lấy category:", error);
    res.status(500).json({
      error: "Có lỗi xảy ra khi lấy category",
    });
  }
});

// Tạo category mới (chỉ admin/editor)
router.post(
  "/",
  authenticate,
  requireEditor,
  [
    body("name")
      .isLength({ min: 1, max: 50 })
      .withMessage("Tên category phải có từ 1-50 ký tự")
      .trim(),
    body("description")
      .optional()
      .isLength({ max: 200 })
      .withMessage("Mô tả không được quá 200 ký tự"),
    body("color")
      .optional()
      .matches(/^#[0-9A-F]{6}$/i)
      .withMessage("Màu sắc phải là mã hex hợp lệ"),
    body("icon")
      .optional()
      .isLength({ max: 50 })
      .withMessage("Icon không được quá 50 ký tự"),
    body("parent").optional().isMongoId().withMessage("Parent ID không hợp lệ"),
    body("sortOrder")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Sort order phải là số nguyên không âm"),
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

      const { name, description, color, icon, parent, sortOrder } = req.body;

      // Kiểm tra category đã tồn tại
      const existingCategory = await Category.findOne({ name });
      if (existingCategory) {
        return res.status(400).json({
          error: "Tên category đã tồn tại",
        });
      }

      // Kiểm tra parent category nếu có
      if (parent) {
        const parentCategory = await Category.findById(parent);
        if (!parentCategory) {
          return res.status(400).json({
            error: "Parent category không tồn tại",
          });
        }
      }

      const category = new Category({
        name,
        description,
        color: color || "#3B82F6",
        icon: icon || "folder",
        parent: parent || null,
        sortOrder: sortOrder || 0,
      });

      await category.save();
      await category.populate("parent", "name slug");

      res.status(201).json({
        message: "Tạo category thành công",
        category,
      });
    } catch (error) {
      console.error("Lỗi tạo category:", error);
      res.status(500).json({
        error: "Có lỗi xảy ra khi tạo category",
      });
    }
  }
);

// Cập nhật category (chỉ admin/editor)
router.put(
  "/:id",
  authenticate,
  requireEditor,
  [
    body("name")
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage("Tên category phải có từ 1-50 ký tự")
      .trim(),
    body("description")
      .optional()
      .isLength({ max: 200 })
      .withMessage("Mô tả không được quá 200 ký tự"),
    body("color")
      .optional()
      .matches(/^#[0-9A-F]{6}$/i)
      .withMessage("Màu sắc phải là mã hex hợp lệ"),
    body("icon")
      .optional()
      .isLength({ max: 50 })
      .withMessage("Icon không được quá 50 ký tự"),
    body("parent").optional().isMongoId().withMessage("Parent ID không hợp lệ"),
    body("sortOrder")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Sort order phải là số nguyên không âm"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive phải là boolean"),
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

      const category = await Category.findById(req.params.id);
      if (!category) {
        return res.status(404).json({
          error: "Không tìm thấy category",
        });
      }

      const { name, description, color, icon, parent, sortOrder, isActive } =
        req.body;

      // Kiểm tra tên category trùng lặp (nếu có thay đổi)
      if (name && name !== category.name) {
        const existingCategory = await Category.findOne({ name });
        if (existingCategory) {
          return res.status(400).json({
            error: "Tên category đã tồn tại",
          });
        }
      }

      // Kiểm tra parent category nếu có
      if (parent && parent !== category.parent?.toString()) {
        if (parent === req.params.id) {
          return res.status(400).json({
            error: "Category không thể là parent của chính nó",
          });
        }

        const parentCategory = await Category.findById(parent);
        if (!parentCategory) {
          return res.status(400).json({
            error: "Parent category không tồn tại",
          });
        }
      }

      // Cập nhật category
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (color !== undefined) updates.color = color;
      if (icon !== undefined) updates.icon = icon;
      if (parent !== undefined) updates.parent = parent || null;
      if (sortOrder !== undefined) updates.sortOrder = sortOrder;
      if (isActive !== undefined) updates.isActive = isActive;

      const updatedCategory = await Category.findByIdAndUpdate(
        req.params.id,
        updates,
        { new: true, runValidators: true }
      ).populate("parent", "name slug");

      res.json({
        message: "Cập nhật category thành công",
        category: updatedCategory,
      });
    } catch (error) {
      console.error("Lỗi cập nhật category:", error);
      res.status(500).json({
        error: "Có lỗi xảy ra khi cập nhật category",
      });
    }
  }
);

// Xóa category (chỉ admin)
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({
        error: "Không tìm thấy category",
      });
    }

    // Kiểm tra có category con không
    const childCategories = await Category.countDocuments({
      parent: req.params.id,
    });
    if (childCategories > 0) {
      return res.status(400).json({
        error: "Không thể xóa category có category con",
      });
    }

    // TODO: Kiểm tra có posts sử dụng category này không
    // const postsCount = await Post.countDocuments({ categories: req.params.id });
    // if (postsCount > 0) {
    //   return res.status(400).json({
    //     error: 'Không thể xóa category đang được sử dụng'
    //   });
    // }

    await Category.findByIdAndDelete(req.params.id);

    res.json({
      message: "Xóa category thành công",
    });
  } catch (error) {
    console.error("Lỗi xóa category:", error);
    res.status(500).json({
      error: "Có lỗi xảy ra khi xóa category",
    });
  }
});

// Lấy cây categories (hierarchical)
router.get("/tree/structure", async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .select("name slug description color icon parent sortOrder");

    // Xây dựng cây categories
    const buildTree = (categories, parentId = null) => {
      return categories
        .filter((cat) => cat.parent?.toString() === parentId)
        .map((cat) => ({
          ...cat.toObject(),
          children: buildTree(categories, cat._id.toString()),
        }));
    };

    const tree = buildTree(categories);

    res.json({ categories: tree });
  } catch (error) {
    console.error("Lỗi lấy cây categories:", error);
    res.status(500).json({
      error: "Có lỗi xảy ra khi lấy cây categories",
    });
  }
});

export default router;
