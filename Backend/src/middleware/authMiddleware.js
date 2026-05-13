const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized: token missing" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ message: "Unauthorized: user not found" });
    }

    req.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl || "",
      bio: user.bio || "",
      phone: user.phone || "",
      role: user.role || "user",
      ownerRestaurantId: user.ownerRestaurantId || "",
    };

    return next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized: invalid token" });
  }
};

exports.requireRole = (...roles) => (req, res, next) => {
  const role = req.user?.role || "user";
  if (!roles.includes(role)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  return next();
};
