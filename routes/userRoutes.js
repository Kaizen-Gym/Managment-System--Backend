import express from "express";
import User from "../models/user.js";
import Role from "../models/role.js";
import protect from "../middleware/protect.js";
import attachGym from "../middleware/attachGym.js";
import logger from "../utils/logger.js";
import { AppError, handleError } from "../utils/errorHandler.js";

const router = express.Router();

// Middleware to check if the user is a manager
const restrictManager = (req, res, next) => {
  try {
    if (req.user.user_type === "Manager") {
      throw new AppError(
        "Managers are not allowed to edit this information",
        403,
      );
    }
    next();
  } catch (error) {
    handleError(error, req, res);
  }
};

// List all users
router.get("/users", protect, attachGym, async (req, res) => {
  try {
    const users = await User.find({ gymId: req.gymId }).select("-password");

    logger.info(`Retrieved ${users.length} users for gym ${req.gymId}`, {
      userTypes: users.map((user) => user.user_type),
    });

    res.status(200).json(users);
  } catch (error) {
    logger.error(`Error fetching users: ${error.message}`);
    handleError(error, req, res);
  }
});

// Edit a user
router.put(
  "/users/:id",
  protect,
  attachGym,
  restrictManager,
  async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Validate update data
      if (Object.keys(updateData).length === 0) {
        throw new AppError("No update data provided", 400);
      }

      // Track changes for logging
      const originalUser = await User.findOne({ _id: id, gymId: req.gymId });
      if (!originalUser) {
        throw new AppError("User not found", 404);
      }

      const user = await User.findOneAndUpdate(
        { _id: id, gymId: req.gymId },
        updateData,
        { new: true },
      ).select("-password");

      logger.info(`Updated user ${id}`, {
        gymId: req.gymId,
        updatedFields: Object.keys(updateData),
        userType: user.user_type,
      });

      res.status(200).json(user);
    } catch (error) {
      logger.error(`Error updating user: ${error.message}`);
      handleError(error, req, res);
    }
  },
);

// Delete a user
router.delete(
  "/users/:id",
  protect,
  attachGym,
  restrictManager,
  async (req, res) => {
    try {
      const { id } = req.params;

      const user = await User.findOne({ _id: id, gymId: req.gymId });
      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Prevent deletion of the last admin
      if (user.user_type === "Admin") {
        const adminCount = await User.countDocuments({
          gymId: req.gymId,
          user_type: "Admin",
        });

        if (adminCount <= 1) {
          throw new AppError("Cannot delete the last admin user", 403);
        }
      }

      await User.deleteOne({ _id: id, gymId: req.gymId });

      logger.info(`Deleted user ${id}`, {
        gymId: req.gymId,
        userType: user.user_type,
        deletedBy: req.user.id,
      });

      res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
      logger.error(`Error deleting user: ${error.message}`);
      handleError(error, req, res);
    }
  },
);

// Get all roles
router.get("/roles", protect, async (req, res) => {
  try {
    const roles = await Role.find({});

    if (roles.length > 0) {
      logger.info(`Retrieved ${roles.length} roles`);
      res.status(200).json(roles);
    } else {
      const enumRoles = User.schema.path("user_type").enumValues;
      logger.info(`Retrieved ${enumRoles.length} enum roles`);
      res.status(200).json(enumRoles);
    }
  } catch (error) {
    logger.error(`Error fetching roles: ${error.message}`);
    handleError(error, req, res);
  }
});

// Create a new user
router.post("/users", protect, attachGym, restrictManager, async (req, res) => {
  try {
    const {
      email,
      name,
      user_type,
      number,
      password,
      gender,
      age,
      permissions,
      gymId,
    } = req.body;

    // Validate required fields
    if (!email || !name || !user_type || !number || !password) {
      throw new AppError("All required fields must be filled", 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError("Invalid email format", 400);
    }

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email }, { number }],
      gymId,
    });

    if (existingUser) {
      throw new AppError("User with this email or number already exists", 409);
    }

    let finalPermissions = permissions;

    // Get default permissions from role if not provided
    if (!finalPermissions) {
      const roleData = await Role.findOne({ roleName: user_type });
      if (roleData) {
        finalPermissions = roleData.defaultPermissions;
        logger.info(`Using default permissions for role ${user_type}`);
      } else {
        finalPermissions = ["view_dashboard"];
        logger.info(`Using fallback permissions for role ${user_type}`);
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
      permissions: finalPermissions,
    });

    logger.info(`Created new user: ${name}`, {
      userId: user._id,
      gymId,
      userType: user_type,
      permissions: finalPermissions,
    });

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json(userResponse);
  } catch (error) {
    logger.error(`Error creating user: ${error.message}`);
    handleError(error, req, res);
  }
});

// Optional: Add a route to get a specific user
router.get("/users/:id", protect, attachGym, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findOne({ _id: id, gymId: req.gymId }).select(
      "-password",
    );

    if (!user) {
      throw new AppError("User not found", 404);
    }

    logger.info(`Retrieved user details for ID: ${id}`);
    res.status(200).json(user);
  } catch (error) {
    logger.error(`Error fetching user details: ${error.message}`);
    handleError(error, req, res);
  }
});

export default router;
