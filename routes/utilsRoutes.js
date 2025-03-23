import express from "express";
import Gym from "../models/gym.js";
import logger from "../utils/logger.js";
import protect from "../middleware/protect.js";
import attachGym from "../middleware/attachGym.js";
import { AppError, handleError } from "../utils/errorHandler.js";

const router = express.Router();

// GET /api/utils/gyms - Get all gyms
router.get("/gyms", protect, attachGym, async (req, res) => {
  try {
    const gyms = await Gym.find();

    logger.info(`Retrieved ${gyms.length} gyms`, {
      userId: req.user._id,
      userRole: req.user.user_type,
    });

    res.json(gyms);
  } catch (error) {
    logger.error(`Error fetching gyms: ${error.message}`, {
      userId: req.user._id,
      error: error.stack,
    });
    handleError(new AppError("Error fetching gyms", 500), req, res);
  }
});

// GET /api/utils/gym - Get specific gym
router.get("/gym", protect, async (req, res) => {
  try {
    const gym = await Gym.findOne({ gymId: req.gymId });

    if (!gym) {
      throw new AppError("Gym not found", 404);
    }

    logger.info(`Retrieved gym details for ${gym.name}`, {
      gymId: req.gymId,
      userId: req.user._id,
      userRole: req.user.user_type,
    });

    res.json(gym);
  } catch (error) {
    logger.error(`Error fetching gym: ${error.message}`, {
      gymId: req.gymId,
      userId: req.user._id,
      error: error.stack,
    });
    handleError(error, req, res);
  }
});

// PUT /api/utils/gym - Update gym details
router.put("/gym", protect, attachGym, async (req, res) => {
  try {
    const { name, address } = req.body;

    // Validate input
    if (!name || !address) {
      throw new AppError("Name and address are required", 400);
    }

    // Log update attempt
    logger.info(`Attempting to update gym ${req.gymId}`, {
      userId: req.user._id,
      updates: { name, address },
    });

    const gym = await Gym.findByIdAndUpdate(
      req.gymId,
      { name, address },
      { new: true, runValidators: true },
    );

    if (!gym) {
      throw new AppError("Gym not found", 404);
    }

    logger.info(`Successfully updated gym ${gym.name}`, {
      gymId: req.gymId,
      userId: req.user._id,
      updates: {
        name: gym.name,
        address: gym.address,
      },
    });

    res.json(gym);
  } catch (error) {
    logger.error(`Error updating gym: ${error.message}`, {
      gymId: req.gymId,
      userId: req.user._id,
      error: error.stack,
    });
    handleError(error, req, res);
  }
});

// Optional: Add a route to get gym statistics
router.get("/gym/stats", protect, attachGym, async (req, res) => {
  try {
    const gym = await Gym.findById(req.gymId);
    if (!gym) {
      throw new AppError("Gym not found", 404);
    }

    // You can add more statistics here
    const stats = {
      name: gym.name,
      address: gym.address,
      createdAt: gym.createdAt,
      updatedAt: gym.updatedAt,
      // Add more stats as needed
    };

    logger.info(`Retrieved statistics for gym ${gym.name}`, {
      gymId: req.gymId,
      userId: req.user._id,
    });

    res.json(stats);
  } catch (error) {
    logger.error(`Error fetching gym statistics: ${error.message}`, {
      gymId: req.gymId,
      userId: req.user._id,
      error: error.stack,
    });
    handleError(error, req, res);
  }
});

// Optional: Add a route to validate gym details
router.post("/gym/validate", protect, async (req, res) => {
  try {
    const { name, address } = req.body;
    const errors = {};

    if (!name || name.length < 2) {
      errors.name = "Gym name must be at least 2 characters long";
    }

    if (!address || address.length < 5) {
      errors.address = "Please provide a valid address";
    }

    if (Object.keys(errors).length > 0) {
      throw new AppError(JSON.stringify(errors), 400);
    }

    logger.info("Gym details validated successfully", {
      userId: req.user._id,
      details: { name, address },
    });

    res.json({
      success: true,
      message: "Gym details are valid",
    });
  } catch (error) {
    logger.error(`Validation error: ${error.message}`, {
      userId: req.user._id,
      error: error.stack,
    });
    handleError(error, req, res);
  }
});

export default router;
