import express from "express";
import User from "../models/user.js";
import protect from "../middleware/protect.js";
import attachGym from "../middleware/attachGym.js";
import logger from "../utils/logger.js";

const router = express.Router();

// Middleware to check if the user is a manager and restrict their editing capabilities
const restrictManager = (req, res, next) => {
  if (req.user.user_type === "Manager") {
    return res.status(403).json({ message: "Managers are not allowed to edit this information" });
  }
  next();
};

// GET /api/users - List all users
router.get("/users", protect, attachGym, async (req, res) => {
  try {
    const users = await User.find({ gymId: req.gymId }).select("-password");
    res.status(200).json(users);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// PUT /api/users/:id - Edit a user by ID
router.put("/users/:id", protect, attachGym, restrictManager, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const user = await User.findOneAndUpdate({ _id: id, gymId: req.gymId }, updateData, { new: true }).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// DELETE /api/users/:id - Delete a user by ID
router.delete("/users/:id", protect, attachGym, restrictManager, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findOneAndDelete({ _id: id, gymId: req.gymId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;
