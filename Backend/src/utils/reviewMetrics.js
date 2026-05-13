const Restaurant = require("../models/Restaurant");
const Review = require("../models/Review");

const syncRestaurantReviewMetrics = async (restaurantId) => {
  const metrics = await Review.aggregate([
    { $match: { restaurantId } },
    {
      $group: {
        _id: "$restaurantId",
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  if (metrics.length === 0) {
    await Restaurant.updateOne(
      { id: restaurantId },
      {
        $set: {
          rating: 0,
          reviews: 0,
          aiScore: 0,
        },
      }
    );
    return { rating: 0, reviews: 0 };
  }

  const aggregate = metrics[0];
  const averageRating = Number(Number(aggregate.averageRating).toFixed(1));
  const totalReviews = Number(aggregate.totalReviews || 0);

  await Restaurant.updateOne(
    { id: restaurantId },
    {
      $set: {
        rating: averageRating,
        reviews: totalReviews,
      },
    }
  );

  return {
    rating: averageRating,
    reviews: totalReviews,
  };
};

module.exports = { syncRestaurantReviewMetrics };
