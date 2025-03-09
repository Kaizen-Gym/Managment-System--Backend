import express from "express";
import User from "../models/user.js";
import Role from "../models/role.js"; // Import the Role model
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

    const user = await User.findOneAndUpdate(
      { _id: id, gymId: req.gymId },
      updateData,
      { new: true }
    ).select("-password");

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

// GET /api/roles - Get all available user roles
router.get("/roles", async (req, res) => {
  try {
    // You might have roles defined in a separate Role collection.
    // If not, you can still fall back to your enum values:
    const roles = await Role.find({});
    if (roles.length > 0) {
      res.status(200).json(roles);
    } else {
      const enumRoles = User.schema.path("user_type").enumValues;
      res.status(200).json(enumRoles);
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// POST /api/users - Create a new user (Registration)
router.post("/users", protect, attachGym, restrictManager, async (req, res) => {
  try {
    const { email, name, user_type, number, password, gender, age, permissions, gymId } = req.body;
    let finalPermissions = permissions;
    
    // If permissions are not provided, use role defaults.
    if (!finalPermissions) {
      const roleData = await Role.findOne({ roleName: user_type });
      if (roleData) {
        finalPermissions = roleData.defaultPermissions;
      } else {
        // Fallback default permissions
        finalPermissions = ["view_dashboard"];
      }
    }

    const user = await User.create({ 
      email, 
      name, 
      user_type, 
      number, 
      password, 
      age, 
      gender, 
      gymId, 
      permissions: finalPermissions 
    });

    res.status(201).json(user);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;
