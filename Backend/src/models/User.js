const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { isValidEmail, normalizeEmail } = require("../utils/validation");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      set: normalizeEmail,
      validate: {
        validator: isValidEmail,
        message: "Please enter a valid email address",
      },
    },
    googleId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      default: undefined,
      set: (value) => {
        const next = String(value || "").trim();
        return next ? next : undefined;
      },
    },
    avatarUrl: {
      type: String,
      default: "",
      trim: true,
    },
    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 30,
    },
    role: {
      type: String,
      enum: ["user", "admin", "owner"],
      default: "user",
      trim: true,
    },
    ownerRestaurantId: {
      type: String,
      default: "",
      trim: true,
    },
    favorites: {
      type: [String],
      default: [],
    },
    password: {
      type: String,
      required: function requirePasswordIfNoGoogle() {
        return !this.googleId;
      },
      minlength: 6,
      select: false,
    },
    resetPasswordTokenHash: {
      type: String,
      default: "",
      select: false,
    },
    resetPasswordExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("User", userSchema);
