const express = require("express");
const { protect, requireRole } = require("../middleware/authMiddleware");
const {
  getProfile,
  updateProfile,
  getFavorites,
  addFavorite,
  removeFavorite,
  listUsers,
} = require("../controllers/userController");

const router = express.Router();

router.get("/", protect, requireRole("admin"), listUsers);
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.get("/favorites", protect, getFavorites);
router.post("/favorites/:restaurantId", protect, addFavorite);
router.delete("/favorites/:restaurantId", protect, removeFavorite);

module.exports = router;
