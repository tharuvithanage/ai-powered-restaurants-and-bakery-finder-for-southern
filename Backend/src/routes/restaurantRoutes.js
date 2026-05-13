const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  getRestaurants,
  getRestaurantById,
  getRestaurantWeather,
  getChatbotRecommendations,
  getRestaurantReviews,
  addRestaurantReview,
} = require("../controllers/restaurantController");

const router = express.Router();

router.get("/", getRestaurants);
router.post("/chatbot/recommend", getChatbotRecommendations);
router.get("/:id/reviews", getRestaurantReviews);
router.post("/:id/reviews", protect, addRestaurantReview);
router.get("/:id/weather", getRestaurantWeather);
router.get("/:id", getRestaurantById);

module.exports = router;
