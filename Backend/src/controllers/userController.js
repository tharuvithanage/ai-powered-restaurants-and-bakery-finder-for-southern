const User = require("../models/User");
const Restaurant = require("../models/Restaurant");

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl || "",
  bio: user.bio || "",
  phone: user.phone || "",
  role: user.role || "user",
  ownerRestaurantId: user.ownerRestaurantId || "",
  favorites: Array.isArray(user.favorites) ? user.favorites : [],
});

exports.listUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .select("name email role createdAt")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    return res.status(200).json({ users });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, avatarUrl, bio, phone } = req.body;
    const updates = {};

    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        return res.status(400).json({ message: "Name cannot be empty" });
      }
      updates.name = trimmedName;
    }

    if (avatarUrl !== undefined) {
      updates.avatarUrl = String(avatarUrl).trim();
    }

    if (bio !== undefined) {
      updates.bio = String(bio).trim();
    }

    if (phone !== undefined) {
      updates.phone = String(phone).trim();
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true, context: "query" }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "Profile updated successfully",
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getFavorites = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("favorites");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const favorites = user.favorites || [];
    const restaurants = await Restaurant.find({ id: { $in: favorites } }).lean();

    const byId = new Map(restaurants.map((item) => [item.id, item]));
    const orderedRestaurants = favorites.map((restaurantId) => byId.get(restaurantId)).filter(Boolean);

    return res.status(200).json({
      favorites,
      restaurants: orderedRestaurants,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.addFavorite = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    if (!restaurantId) {
      return res.status(400).json({ message: "restaurantId is required" });
    }

    const restaurant = await Restaurant.findOne({ id: restaurantId });
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $addToSet: { favorites: restaurantId } },
      { returnDocument: "after" }
    ).select("favorites");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "Restaurant saved to favorites",
      favorites: user.favorites || [],
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.removeFavorite = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    if (!restaurantId) {
      return res.status(400).json({ message: "restaurantId is required" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { favorites: restaurantId } },
      { returnDocument: "after" }
    ).select("favorites");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "Restaurant removed from favorites",
      favorites: user.favorites || [],
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
