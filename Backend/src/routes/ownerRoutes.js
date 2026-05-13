const express = require("express");
const { protect, requireRole } = require("../middleware/authMiddleware");
const { getMyRestaurant, updateMyMenu } = require("../controllers/ownerController");

const router = express.Router();

router.use(protect, requireRole("owner"));

router.get("/restaurant", getMyRestaurant);
router.put("/restaurant/menu", updateMyMenu);

module.exports = router;

