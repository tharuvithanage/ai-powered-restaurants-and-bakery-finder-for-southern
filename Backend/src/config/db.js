const mongoose = require("mongoose");
const dns = require("dns");

const configureDnsForMongo = () => {
  const rawServers = process.env.MONGO_DNS_SERVERS || "8.8.8.8,1.1.1.1";
  const servers = rawServers
    .split(",")
    .map((server) => server.trim())
    .filter(Boolean);

  if (servers.length === 0) {
    return;
  }

  try {
    dns.setServers(servers);
    console.log(`Using custom DNS servers for MongoDB: ${servers.join(", ")}`);
  } catch (error) {
    console.warn("Failed to set custom DNS servers:", error.message);
  }
};

const connectDB = async () => {
  try {
    configureDnsForMongo();

    console.log("Attempting to connect to MongoDB...");
    console.log("Connection string exists:", !!process.env.MONGO_URI);

    const options = {
      family: 4,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      retryReads: true,
    };

    await mongoose.connect(process.env.MONGO_URI, options);
    console.log("MongoDB Connected ");
  } catch (error) {
    console.error("MongoDB connection failed ?");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);

    if (error.name === "MongoServerSelectionError") {
      console.log("\nTroubleshooting tips:");
      console.log("1. Check your internet connection");
      console.log("2. In MongoDB Atlas, go to Network Access and add your IP address");
      console.log("3. Try adding 0.0.0.0/0 to Network Access for testing");
      console.log("4. Your password might have special characters that need encoding");
      console.log("5. Set MONGO_DNS_SERVERS in .env if your network blocks default DNS");
    }

    process.exit(1);
  }
};

module.exports = connectDB;
