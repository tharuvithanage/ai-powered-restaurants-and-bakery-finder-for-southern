const mongoose = require("mongoose");
const User = require("../models/User");
const Review = require("../models/Review");
const Restaurant = require("../models/Restaurant");
const { syncRestaurantReviewMetrics } = require("../utils/reviewMetrics");
const { PRICE_RANGES, normalizePriceRange } = require("../utils/priceRange");

const sanitizeUserRow = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role || "user",
  ownerRestaurantId: user.ownerRestaurantId || "",
  createdAt: user.createdAt,
});

exports.listUsers = async (req, res) => {
  try {
    const requestedLimit = Number(req.query.limit);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(500, Math.floor(requestedLimit))
      : 200;

    const q = String(req.query.q || "").trim();
    const query = q
      ? {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
          ],
        }
      : {};

    const users = await User.find(query)
      .select("name email role ownerRestaurantId createdAt")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({ users: users.map(sanitizeUserRow) });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.setUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const role = String(req.body?.role || "").trim();
    const ownerRestaurantId = String(req.body?.ownerRestaurantId || "").trim();

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    if (!["user", "admin", "owner"].includes(role)) {
      return res.status(400).json({ message: "Role must be 'user', 'owner', or 'admin'" });
    }

    if (String(req.user?.id) === String(userId) && role !== "admin") {
      return res.status(400).json({ message: "You cannot remove your own admin role" });
    }

    const updates = { role };

    if (role === "owner") {
      if (!ownerRestaurantId) {
        return res.status(400).json({ message: "ownerRestaurantId is required for owner role" });
      }

      const restaurant = await Restaurant.findOne({ id: ownerRestaurantId }).select("id").lean();
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found for ownerRestaurantId" });
      }

      updates.ownerRestaurantId = ownerRestaurantId;
    } else {
      updates.ownerRestaurantId = "";
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { returnDocument: "after", runValidators: true, context: "query" }
    )
      .select("name email role ownerRestaurantId createdAt")
      .lean();

    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ message: "Role updated", user: sanitizeUserRow(updated) });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    if (String(req.user?.id) === String(userId)) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }

    const user = await User.findById(userId).select("email role").lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const deletedReviews = await Review.find({ userId }).select("restaurantId").lean();
    await Review.deleteMany({ userId });
    await User.deleteOne({ _id: userId });

    const restaurantIds = Array.from(
      new Set(deletedReviews.map((r) => String(r.restaurantId)).filter(Boolean))
    );
    for (const restaurantId of restaurantIds) {
      await syncRestaurantReviewMetrics(restaurantId);
    }

    return res.status(200).json({
      message: "User deleted",
      deletedReviews: deletedReviews.length,
      updatedRestaurants: restaurantIds.length,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.listReviews = async (req, res) => {
  try {
    const requestedLimit = Number(req.query.limit);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(200, Math.floor(requestedLimit))
      : 50;

    const restaurantId = String(req.query.restaurantId || "").trim();
    const userId = String(req.query.userId || "").trim();
    const query = {};
    if (restaurantId) query.restaurantId = restaurantId;
    if (userId) {
      if (!mongoose.isValidObjectId(userId)) {
        return res.status(400).json({ message: "Invalid userId filter" });
      }
      query.userId = userId;
    }

    const reviews = await Review.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({ reviews });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    if (!mongoose.isValidObjectId(reviewId)) {
      return res.status(400).json({ message: "Invalid reviewId" });
    }

    const review = await Review.findById(reviewId).select("restaurantId").lean();
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    await Review.deleteOne({ _id: reviewId });
    const metrics = await syncRestaurantReviewMetrics(String(review.restaurantId));

    return res.status(200).json({ message: "Review deleted", restaurantMetrics: metrics });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

const sanitizeRestaurantRow = (restaurant) => ({
  id: restaurant.id,
  name: restaurant.name,
  location: restaurant.location,
  price: normalizePriceRange(restaurant.price) || restaurant.price,
  rating: restaurant.rating,
  reviews: restaurant.reviews,
  image: restaurant.image || "",
  desc: restaurant.desc || "",
  hours: restaurant.hours || "",
  vibe: restaurant.vibe || "",
  bestTime: restaurant.bestTime || "",
  goodFor: Array.isArray(restaurant.goodFor) ? restaurant.goodFor : [],
  address: restaurant.address || "",
  nearby: Array.isArray(restaurant.nearby) ? restaurant.nearby : [],
  dietaryTags: Array.isArray(restaurant.dietaryTags) ? restaurant.dietaryTags : [],
  mapQuery: restaurant.mapQuery || "",
  coordinates: restaurant.coordinates || {},
  createdAt: restaurant.createdAt,
  updatedAt: restaurant.updatedAt,
});

const sanitizeRestaurantDetails = (restaurant) => ({
  ...sanitizeRestaurantRow(restaurant),
  budget: Array.isArray(restaurant.budget) ? restaurant.budget : [],
  premium: Array.isArray(restaurant.premium) ? restaurant.premium : [],
  menuCategories: restaurant.menuCategories && typeof restaurant.menuCategories === "object"
    ? restaurant.menuCategories
    : {},
  menuUpdatedAt: restaurant.menuUpdatedAt || null,
  menuUpdatedBy: restaurant.menuUpdatedBy || null,
});

const isValidRestaurantId = (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || "").trim());

const sanitizeMenuItem = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name || "").trim();
  const price = String(raw.price || "").trim();
  if (!name || !price) return null;
  return { name, price };
};

const sanitizeMenuList = (raw, fieldName) => {
  if (raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new Error(`${fieldName} must be an array of { name, price }`);
  }
  return raw.map(sanitizeMenuItem).filter(Boolean);
};

const sanitizeMenuCategories = (raw) => {
  if (raw === null) {
    return { breakfast: [], main: [], drinks: [] };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("menuCategories must be an object with breakfast/main/drinks arrays");
  }

  const breakfast = raw.breakfast === undefined ? undefined : sanitizeMenuList(raw.breakfast, "menuCategories.breakfast");
  const main = raw.main === undefined ? undefined : sanitizeMenuList(raw.main, "menuCategories.main");
  const drinks = raw.drinks === undefined ? undefined : sanitizeMenuList(raw.drinks, "menuCategories.drinks");

  const cleaned = {};
  if (breakfast !== undefined) cleaned.breakfast = breakfast;
  if (main !== undefined) cleaned.main = main;
  if (drinks !== undefined) cleaned.drinks = drinks;
  return cleaned;
};

exports.listRestaurants = async (req, res) => {
  try {
    const requestedLimit = Number(req.query.limit);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(500, Math.floor(requestedLimit))
      : 200;

    const q = String(req.query.q || "").trim();
    const query = q
      ? {
          $or: [
            { id: { $regex: q, $options: "i" } },
            { name: { $regex: q, $options: "i" } },
            { location: { $regex: q, $options: "i" } },
          ],
        }
      : {};

    const restaurants = await Restaurant.find(query)
      .select("id name location price rating reviews image desc hours vibe bestTime goodFor address nearby dietaryTags mapQuery coordinates createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({ restaurants: restaurants.map(sanitizeRestaurantRow) });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getRestaurant = async (req, res) => {
  try {
    const restaurantId = String(req.params.restaurantId || "").trim();
    if (!restaurantId) {
      return res.status(400).json({ message: "restaurantId is required" });
    }

    const restaurant = await Restaurant.findOne({ id: restaurantId }).lean();
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    return res.status(200).json({ restaurant: sanitizeRestaurantDetails(restaurant) });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.createRestaurant = async (req, res) => {
  try {
    const id = String(req.body?.id || "").trim();
    const name = String(req.body?.name || "").trim();
    const location = String(req.body?.location || "").trim();
    const rawPrice = String(req.body?.price || "").trim();
    const price = normalizePriceRange(rawPrice);

    if (!id || !name || !location || !price) {
      return res.status(400).json({ message: "id, name, location and price are required" });
    }
    if (!PRICE_RANGES.includes(price)) {
      return res.status(400).json({ message: `price must be one of: ${PRICE_RANGES.join(", ")}` });
    }

    if (!isValidRestaurantId(id)) {
      return res.status(400).json({ message: "id must be a slug like 'my-restaurant-1'" });
    }

    const existing = await Restaurant.findOne({ id }).select("id").lean();
    if (existing) {
      return res.status(409).json({ message: "Restaurant id already exists" });
    }

    const payload = {
      id,
      name,
      location,
      price,
      rating: 0,
      reviews: 0,
    };

    const optionalStrings = [
      "image",
      "desc",
      "hours",
      "vibe",
      "bestTime",
      "address",
      "mapQuery",
    ];
    for (const key of optionalStrings) {
      if (req.body?.[key] !== undefined) {
        payload[key] = String(req.body[key] || "").trim();
      }
    }

    if (Array.isArray(req.body?.goodFor)) payload.goodFor = req.body.goodFor.map((x) => String(x).trim()).filter(Boolean);
    if (Array.isArray(req.body?.nearby)) payload.nearby = req.body.nearby.map((x) => String(x).trim()).filter(Boolean);
    if (Array.isArray(req.body?.dietaryTags)) payload.dietaryTags = req.body.dietaryTags.map((x) => String(x).trim()).filter(Boolean);

    if (req.body?.coordinates && typeof req.body.coordinates === "object") {
      const lat = Number(req.body.coordinates.lat);
      const lng = Number(req.body.coordinates.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        payload.coordinates = { lat, lng };
      }
    }

    let menuTouched = false;
    try {
      if (req.body?.budget !== undefined) {
        payload.budget = sanitizeMenuList(req.body.budget, "budget");
        menuTouched = true;
      }
      if (req.body?.premium !== undefined) {
        payload.premium = sanitizeMenuList(req.body.premium, "premium");
        menuTouched = true;
      }
      if (req.body?.menuCategories !== undefined) {
        payload.menuCategories = sanitizeMenuCategories(req.body.menuCategories);
        menuTouched = true;
      }
    } catch (menuError) {
      return res.status(400).json({ message: menuError.message });
    }

    if (menuTouched) {
      payload.menuUpdatedAt = new Date();
      payload.menuUpdatedBy = req.user?.id;
    }

    const created = await Restaurant.create(payload);
    return res.status(201).json({
      message: "Restaurant created",
      restaurant: sanitizeRestaurantRow(created.toObject()),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Restaurant id already exists" });
    }
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.updateRestaurant = async (req, res) => {
  try {
    const restaurantId = String(req.params.restaurantId || "").trim();
    if (!restaurantId) {
      return res.status(400).json({ message: "restaurantId is required" });
    }

    if (req.body?.id !== undefined && String(req.body.id).trim() !== restaurantId) {
      return res.status(400).json({ message: "Restaurant id cannot be changed" });
    }

    const updates = {};
    const updatableStrings = [
      "name",
      "location",
      "price",
      "image",
      "desc",
      "hours",
      "vibe",
      "bestTime",
      "address",
      "mapQuery",
    ];
    for (const key of updatableStrings) {
      if (req.body?.[key] !== undefined) {
        const value = String(req.body[key] || "").trim();
        if (["name", "location", "price"].includes(key) && !value) {
          return res.status(400).json({ message: `${key} cannot be empty` });
        }
        updates[key] = value;
      }
    }
    if (updates.price !== undefined) {
      const normalized = normalizePriceRange(updates.price);
      if (!PRICE_RANGES.includes(normalized)) {
        return res.status(400).json({ message: `price must be one of: ${PRICE_RANGES.join(", ")}` });
      }
      updates.price = normalized;
    }

    if (req.body?.goodFor !== undefined) {
      if (!Array.isArray(req.body.goodFor)) {
        return res.status(400).json({ message: "goodFor must be an array of strings" });
      }
      updates.goodFor = req.body.goodFor.map((x) => String(x).trim()).filter(Boolean);
    }

    if (req.body?.nearby !== undefined) {
      if (!Array.isArray(req.body.nearby)) {
        return res.status(400).json({ message: "nearby must be an array of strings" });
      }
      updates.nearby = req.body.nearby.map((x) => String(x).trim()).filter(Boolean);
    }

    if (req.body?.dietaryTags !== undefined) {
      if (!Array.isArray(req.body.dietaryTags)) {
        return res.status(400).json({ message: "dietaryTags must be an array of strings" });
      }
      updates.dietaryTags = req.body.dietaryTags.map((x) => String(x).trim()).filter(Boolean);
    }

    if (req.body?.coordinates !== undefined) {
      if (req.body.coordinates === null) {
        updates.coordinates = { lat: undefined, lng: undefined };
      } else if (typeof req.body.coordinates === "object") {
        const lat = Number(req.body.coordinates.lat);
        const lng = Number(req.body.coordinates.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          updates.coordinates = { lat, lng };
        } else {
          return res.status(400).json({ message: "coordinates.lat and coordinates.lng must be numbers" });
        }
      } else {
        return res.status(400).json({ message: "coordinates must be an object" });
      }
    }

    let menuTouched = false;
    try {
      if (req.body?.budget !== undefined) {
        updates.budget = sanitizeMenuList(req.body.budget, "budget");
        menuTouched = true;
      }
      if (req.body?.premium !== undefined) {
        updates.premium = sanitizeMenuList(req.body.premium, "premium");
        menuTouched = true;
      }
      if (req.body?.menuCategories !== undefined) {
        const categoriesUpdate = sanitizeMenuCategories(req.body.menuCategories);
        if (Object.keys(categoriesUpdate).length === 0) {
          return res.status(400).json({ message: "menuCategories must include breakfast/main/drinks" });
        }
        for (const [key, value] of Object.entries(categoriesUpdate)) {
          updates[`menuCategories.${key}`] = value;
        }
        menuTouched = true;
      }
    } catch (menuError) {
      return res.status(400).json({ message: menuError.message });
    }

    if (menuTouched) {
      updates.menuUpdatedAt = new Date();
      updates.menuUpdatedBy = req.user?.id;
    }

    const updated = await Restaurant.findOneAndUpdate(
      { id: restaurantId },
      { $set: updates },
      { returnDocument: "after", runValidators: true, context: "query" }
    )
      .select("id name location price rating reviews image desc hours vibe bestTime goodFor address nearby dietaryTags mapQuery coordinates createdAt updatedAt")
      .lean();

    if (!updated) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    return res.status(200).json({ message: "Restaurant updated", restaurant: sanitizeRestaurantRow(updated) });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.deleteRestaurant = async (req, res) => {
  try {
    const restaurantId = String(req.params.restaurantId || "").trim();
    if (!restaurantId) {
      return res.status(400).json({ message: "restaurantId is required" });
    }

    const restaurant = await Restaurant.findOne({ id: restaurantId }).select("id").lean();
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    const deletedReviews = await Review.deleteMany({ restaurantId });
    await Restaurant.deleteOne({ id: restaurantId });

    return res.status(200).json({
      message: "Restaurant deleted",
      deletedReviews: deletedReviews?.deletedCount || 0,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
