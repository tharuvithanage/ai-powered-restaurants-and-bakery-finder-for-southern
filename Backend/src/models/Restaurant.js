const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const menuCategoriesSchema = new mongoose.Schema(
  {
    breakfast: [menuItemSchema],
    main: [menuItemSchema],
    drinks: [menuItemSchema],
  },
  { _id: false }
);

const restaurantSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 0, max: 5 },
    reviews: { type: Number, default: 0 },
    price: { type: String, required: true, trim: true },
    aiScore: { type: Number, default: 0 },
    image: { type: String, default: "" },
    desc: { type: String, default: "" },
    hours: { type: String, default: "" },
    vibe: { type: String, default: "" },
    bestTime: { type: String, default: "" },
    goodFor: [{ type: String, trim: true }],
    address: { type: String, default: "" },
    nearby: [{ type: String, trim: true }],
    budget: [menuItemSchema],
    premium: [menuItemSchema],
    menuCategories: { type: menuCategoriesSchema, default: () => ({}) },
    dietaryTags: [{ type: String, trim: true }],
    reviewsPreview: [{ type: String, trim: true }],
    mapQuery: { type: String, default: "" },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    menuUpdatedAt: { type: Date },
    menuUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Prefer `rankingScore` in APIs/UI, but keep `aiScore` as the stored field for
// backward compatibility with existing data.
restaurantSchema
  .virtual("rankingScore")
  .get(function () {
    return this.aiScore;
  })
  .set(function (value) {
    this.aiScore = value;
  });

module.exports = mongoose.model("Restaurant", restaurantSchema);
