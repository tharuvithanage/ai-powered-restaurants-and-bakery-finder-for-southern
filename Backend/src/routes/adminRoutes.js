const express = require("express");
const { protect, requireRole } = require("../middleware/authMiddleware");
const {
  listUsers,
  setUserRole,
  deleteUser,
  listReviews,
  deleteReview,
  listRestaurants,
  getRestaurant,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
} = require("../controllers/adminController");

const router = express.Router();

router.use(protect, requireRole("admin"));

router.get("/users", listUsers);
router.patch("/users/:userId/role", setUserRole);
router.delete("/users/:userId", deleteUser);

router.get("/reviews", listReviews);
router.delete("/reviews/:reviewId", deleteReview);

router.get("/restaurants", listRestaurants);
router.get("/restaurants/:restaurantId", getRestaurant);
router.post("/restaurants", createRestaurant);
router.patch("/restaurants/:restaurantId", updateRestaurant);
router.delete("/restaurants/:restaurantId", deleteRestaurant);

module.exports = router;
