const Restaurant = require("../models/Restaurant");
const { PRICE_RANGES, normalizePriceRange } = require("../utils/priceRange");

const sanitizeRestaurantForOwner = (restaurant) => ({
  id: restaurant.id,
  name: restaurant.name,
  location: restaurant.location,
  price: normalizePriceRange(restaurant.price) || restaurant.price,
  image: restaurant.image || "",
  desc: restaurant.desc || "",
  hours: restaurant.hours || "",
  vibe: restaurant.vibe || "",
  budget: Array.isArray(restaurant.budget) ? restaurant.budget : [],
  premium: Array.isArray(restaurant.premium) ? restaurant.premium : [],
  menuCategories:
    restaurant.menuCategories && typeof restaurant.menuCategories === "object"
      ? restaurant.menuCategories
      : {},
  menuUpdatedAt: restaurant.menuUpdatedAt || null,
});

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

  const breakfast =
    raw.breakfast === undefined ? undefined : sanitizeMenuList(raw.breakfast, "menuCategories.breakfast");
  const main =
    raw.main === undefined ? undefined : sanitizeMenuList(raw.main, "menuCategories.main");
  const drinks =
    raw.drinks === undefined ? undefined : sanitizeMenuList(raw.drinks, "menuCategories.drinks");

  const cleaned = {};
  if (breakfast !== undefined) cleaned.breakfast = breakfast;
  if (main !== undefined) cleaned.main = main;
  if (drinks !== undefined) cleaned.drinks = drinks;
  return cleaned;
};

const requireOwnerRestaurantId = (req) => String(req.user?.ownerRestaurantId || "").trim();

exports.getMyRestaurant = async (req, res) => {
  try {
    const restaurantId = requireOwnerRestaurantId(req);
    if (!restaurantId) {
      return res.status(403).json({ message: "Owner restaurant is not assigned" });
    }

    const restaurant = await Restaurant.findOne({ id: restaurantId }).lean();
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    return res.status(200).json({ restaurant: sanitizeRestaurantForOwner(restaurant) });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.updateMyMenu = async (req, res) => {
  try {
    const restaurantId = requireOwnerRestaurantId(req);
    if (!restaurantId) {
      return res.status(403).json({ message: "Owner restaurant is not assigned" });
    }

    const updates = {};

    if (req.body?.price !== undefined) {
      const price = String(req.body.price || "").trim();
      if (!price) return res.status(400).json({ message: "price cannot be empty" });
      const normalized = normalizePriceRange(price);
      if (!PRICE_RANGES.includes(normalized)) {
        return res.status(400).json({ message: `price must be one of: ${PRICE_RANGES.join(", ")}` });
      }
      updates.price = normalized;
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

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No updates provided" });
    }

    const updated = await Restaurant.findOneAndUpdate(
      { id: restaurantId },
      { $set: updates },
      { returnDocument: "after", runValidators: true, context: "query" }
    ).lean();

    if (!updated) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    return res.status(200).json({
      message: "Menu updated",
      restaurant: sanitizeRestaurantForOwner(updated),
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
