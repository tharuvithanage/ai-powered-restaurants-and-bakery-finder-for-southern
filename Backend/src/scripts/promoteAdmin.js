const path = require("path");

const defaultEnvPath = path.resolve(__dirname, "../../.env");
const envPath = process.env.ENV_PATH
  ? path.resolve(process.cwd(), process.env.ENV_PATH)
  : defaultEnvPath;

require("dotenv").config({ path: envPath });
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const { normalizeEmail } = require("../utils/validation");

const main = async () => {
  const rawEmail = process.argv[2];
  if (!rawEmail) {
    console.error("Usage: node src/scripts/promoteAdmin.js <email>");
    process.exit(2);
  }

  const email = normalizeEmail(rawEmail);
  if (!email) {
    console.error("Please provide a valid email.");
    process.exit(2);
  }

  if (!process.env.MONGO_URI) {
    console.error("Missing MONGO_URI. Check your Backend/.env (or set ENV_PATH to your env file).");
    process.exit(2);
  }

  await connectDB();

  const user = await User.findOneAndUpdate(
    { email },
    { $set: { role: "admin" } },
    { returnDocument: "after" }
  ).select("email role");

  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  console.log(`Updated ${user.email} role => ${user.role}`);
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
