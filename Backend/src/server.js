// src/server.js
const express = require("express");
const cors = require("cors");
const path = require('path');
require("dotenv").config({ path: './.env' });

// Debug: Check if env loaded
console.log('Current directory:', __dirname);
console.log('Looking for .env at:', path.join(__dirname, '.env'));
console.log('MONGO_URI value:', process.env.MONGO_URI ? 'Found ✅' : 'Not Found ❌');
console.log('MONGO_URI length:', process.env.MONGO_URI ? process.env.MONGO_URI.length : 0);

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const restaurantRoutes = require("./routes/restaurantRoutes");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const ownerRoutes = require("./routes/ownerRoutes");

const app = express();

// Connect to MongoDB
connectDB();

// middlewares
app.use(cors());
app.use(express.json({ limit: "6mb" }));
app.use(express.urlencoded({ extended: true, limit: "6mb" }));
app.use("/api/auth", authRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/owner", ownerRoutes);

// test route
app.get("/", (req, res) => {
  res.send("Backend server is running 🚀");
});

// start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
