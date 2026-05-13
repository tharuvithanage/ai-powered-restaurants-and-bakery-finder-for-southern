const fs = require("fs");
const path = require("path");

const defaultEnvPath = path.resolve(__dirname, "../../.env");
const envPath = process.env.ENV_PATH
  ? path.resolve(process.cwd(), process.env.ENV_PATH)
  : defaultEnvPath;

require("dotenv").config({ path: envPath });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Restaurant = require("../models/Restaurant");

const isValidRestaurantId = (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || "").trim());

const usage = () => {
  console.error("Usage:");
  console.error("  node src/scripts/createRestaurant.js <id> <name> <location> <price>");
  console.error("  node src/scripts/createRestaurant.js --json <path-to-json>");
  console.error("");
  console.error("Examples:");
  console.error('  node src/scripts/createRestaurant.js my-new-restaurant "My New Restaurant" "Galle" "Moderate"');
  console.error("  node src/scripts/createRestaurant.js --json ./restaurant.json");
};

const readJsonFile = (filePath) => {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const raw = fs.readFileSync(absolutePath, "utf8");
  return JSON.parse(raw);
};

const pickOptionalFields = (source) => {
  const payload = {};

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
    if (source?.[key] !== undefined) payload[key] = String(source[key] || "").trim();
  }

  const optionalStringArrays = ["goodFor", "nearby", "dietaryTags", "reviewsPreview"];
  for (const key of optionalStringArrays) {
    if (Array.isArray(source?.[key])) {
      payload[key] = source[key].map((x) => String(x).trim()).filter(Boolean);
    }
  }

  if (source?.coordinates && typeof source.coordinates === "object") {
    const lat = Number(source.coordinates.lat);
    const lng = Number(source.coordinates.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) payload.coordinates = { lat, lng };
  }

  if (source?.menuCategories && typeof source.menuCategories === "object") {
    payload.menuCategories = source.menuCategories;
  }
  if (Array.isArray(source?.budget)) payload.budget = source.budget;
  if (Array.isArray(source?.premium)) payload.premium = source.premium;

  return payload;
};

const main = async () => {
  const args = process.argv.slice(2);

  if (!process.env.MONGO_URI) {
    console.error("Missing MONGO_URI. Check your Backend/.env (or set ENV_PATH to your env file).");
    process.exit(2);
  }

  let basePayload;
  if (args[0] === "--json") {
    const jsonPath = args[1];
    if (!jsonPath) {
      usage();
      process.exit(2);
    }
    basePayload = readJsonFile(jsonPath);
  } else {
    const [id, name, location, price] = args;
    if (!id || !name || !location || !price) {
      usage();
      process.exit(2);
    }
    basePayload = { id, name, location, price };
  }

  const id = String(basePayload?.id || "").trim();
  const name = String(basePayload?.name || "").trim();
  const location = String(basePayload?.location || "").trim();
  const price = String(basePayload?.price || "").trim();

  if (!id || !name || !location || !price) {
    console.error("id, name, location and price are required.");
    process.exit(2);
  }

  if (!isValidRestaurantId(id)) {
    console.error("id must be a slug like 'my-restaurant-1'.");
    process.exit(2);
  }

  await connectDB();

  const existing = await Restaurant.findOne({ id }).select("id").lean();
  if (existing) {
    console.error(`Restaurant already exists: ${id}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const payload = {
    id,
    name,
    location,
    price,
    rating: 0,
    reviews: 0,
    ...pickOptionalFields(basePayload),
  };

  const created = await Restaurant.create(payload);
  console.log(`Created restaurant: ${created.id} (${created.name})`);
  await mongoose.disconnect();
};

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
