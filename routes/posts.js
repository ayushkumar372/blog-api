const express = require("express");
const sanitizeHtml = require("sanitize-html");
const slugify = require("slugify");
const Post = require("../models/Post");
const auth = require("../middleware/auth");
const router = express.Router();

// Allowed HTML tags from Tiptap
const sanitizeOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    "img", "h1", "h2", "h3", "u", "s", "mark", "pre", "code",
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ["src", "alt", "width", "height"],
    "*": ["class", "style"],
  },
};

// GET /api/posts — public, published only
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10, tag } = req.query;
    const filter = { status: "published" };
    if (tag) filter.tags = tag;

    const posts = await Post.find(filter)
      .select("title slug excerpt coverImage tags createdAt views")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Post.countDocuments(filter);
    res.json({ posts, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/posts/all — admin, all posts including drafts
router.get("/all", auth, async (req, res) => {
  try {
    const posts = await Post.find()
      .select("title slug status createdAt views")
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/posts/:slug — public
router.get("/:slug", async (req, res) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug });
    if (!post) return res.status(404).json({ error: "Post not found" });
    post.views += 1;
    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/posts — admin only
router.post("/", auth, async (req, res) => {
  try {
    const { title, content, excerpt, coverImage, tags, status } = req.body;
    const slug = slugify(title, { lower: true, strict: true });
    const cleanContent = sanitizeHtml(content, sanitizeOptions);

    const post = await Post.create({
      title,
      slug,
      content: cleanContent,
      excerpt: excerpt || cleanContent.replace(/<[^>]+>/g, "").slice(0, 160),
      coverImage,
      tags: tags || [],
      status: status || "draft",
    });

    res.status(201).json(post);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "Slug already exists" });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/posts/:id — admin only
router.put("/:id", auth, async (req, res) => {
  try {
    const { title, content, excerpt, coverImage, tags, status } = req.body;
    const cleanContent = sanitizeHtml(content, sanitizeOptions);

    const post = await Post.findByIdAndUpdate(
      req.params.id,
      {
        title,
        content: cleanContent,
        excerpt: excerpt || cleanContent.replace(/<[^>]+>/g, "").slice(0, 160),
        coverImage,
        tags,
        status,
      },
      { new: true }
    );

    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/posts/:id — admin only
router.delete("/:id", auth, async (req, res) => {
  try {
    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: "Post deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
