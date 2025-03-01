import dotenv from "dotenv";
dotenv.config();
import express from "express";
import User from "../models/user.js";
import jwt from "jsonwebtoken";
import logger from "../utils/logger.js";
import protect from "../middleware/protect.js";
import attachGym from '../middleware/attachGym.js';

const router = express.Router();

// Generate JWT Token
const generateToken = (userId, gymId) => {
  return jwt.sign({ id: userId, gymId: gymId }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

// **Register User**
router.post("/register", async (req, res) => {
  try {
    // Extract gymId from the request body since attachGym is not applied here.
    let { name, gender, age, email, number, password, user_type, gymId } = req.body;

    if (!name || !gender || !age || !email || !number || !password || !gymId) {
      return res.status(400).json({ message: "All required fields must be filled" });
    }

    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(409).json({ message: "User already exists" });

    // Check if any admin exists in the system
    const adminExists = await User.findOne({ user_type: "Admin" });

    if (adminExists) {
      // If an admin exists, only an admin can create new accounts.
      // Require the request to include a valid admin token.
      if (!req.headers.authorization) {
        return res.status(403).json({ message: "Not authorized to create accounts" });
      }
      const token = req.headers.authorization.split(" ")[1]?.trim();
      if (!token) {
        return res.status(403).json({ message: "Not authorized to create accounts" });
      }
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const currentUser = await User.findById(decoded.id);
        if (!currentUser || currentUser.user_type !== "Admin") {
          return res.status(403).json({ message: "Not authorized to create accounts" });
        }
      } catch (error) {
        logger.error("Invalid token", error);
        return res.status(403).json({ message: "Invalid token" });
      }
    } else {
      // Bootstrapping: If no admin exists, allow registration of the first account.
      // Optionally force the first account to be an Admin.
      user_type = user_type || "Admin";
    }

    // Create the new user using gymId from the request body.
    const user = await User.create({
      name,
      gender,
      age,
      email,
      number,
      password,
      user_type,
      gymId: gymId,
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      number: user.number,
      email: user.email,
      role: user.user_type,
      token: generateToken(user._id, user.gymId),
    });
    logger.info(`User registered: ${user.name}`);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error });
  }
});

// **Login User**
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Please provide email and password" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await user.matchPassword(password); // Use model's method
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id, user.gymId),
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error });
  }
});

// **Logout User**
router.post("/logout", protect, attachGym, async (req, res) => {
  try {
    res.clearCookie("token", { path: "/" });
    res.status(200).json({
      message: "Logged out successfully. Please remove token from local storage.",
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// **Get User Profile**
router.get("/profile", protect, attachGym, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;
