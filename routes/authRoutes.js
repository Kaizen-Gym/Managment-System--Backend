import dotenv from "dotenv";
dotenv.config();
import express from "express";
import User from "../models/user.js";
import jwt from "jsonwebtoken";
import logger from "../utils/logger.js";
import protect from "../middleware/protect.js";
import attachGym from "../middleware/attachGym.js";

const router = express.Router();

const refreshTokens = new Map();

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // false in development
  sameSite: "lax", // Important for cross-site cookies
  path: "/",
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
};

// Generate JWT Token
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user._id, gymId: user.gymId },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }, // Short lived access token
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }, // Longer lived refresh token
  );

  return { accessToken, refreshToken };
};
// **Register User**
router.post("/register", async (req, res) => {
  try {
    let { name, gender, age, email, number, password, user_type, gymId } =
      req.body;

    if (!name || !gender || !age || !email || !number || !password || !gymId) {
      return res
        .status(400)
        .json({ message: "All required fields must be filled" });
    }

    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(409).json({ message: "User already exists" });

    // Check if any admin exists in the system
    const adminExists = await User.findOne({ user_type: "Admin" });
    if (adminExists) {
      if (!req.headers.authorization) {
        return res
          .status(403)
          .json({ message: "Not authorized to create accounts" });
      }
      const token = req.headers.authorization.split(" ")[1]?.trim();
      if (!token) {
        return res
          .status(403)
          .json({ message: "Not authorized to create accounts" });
      }
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const currentUser = await User.findById(decoded.id);
        if (!currentUser || currentUser.user_type !== "Admin") {
          return res
            .status(403)
            .json({ message: "Not authorized to create accounts" });
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

    // Define default permissions based on user_type:
    let defaultPermissions = [];
    switch (user_type) {
      case "Admin":
        defaultPermissions = [
          "view_dashboard",
          "view_members",
          "view_reports",
          "view_membership_plans",
          "view_settings",
          "manage_users",
        ];
        break;
      case "Trainer":
        defaultPermissions = ["view_dashboard", "view_members"];
        break;
      case "Receptionist":
        defaultPermissions = ["view_dashboard", "view_members"];
        break;
      case "Manager":
        defaultPermissions = [
          "view_dashboard",
          "view_reports",
          "view_settings",
        ];
        break;
      default:
        defaultPermissions = ["view_dashboard"];
    }

    // Create the new user using gymId from the request body, including permissions.
    const user = await User.create({
      name,
      gender,
      age,
      email,
      number,
      password,
      user_type,
      permissions: defaultPermissions,
      gymId: gymId,
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      number: user.number,
      email: user.email,
      role: user.user_type,
      permissions: user.permissions,
      token: generateTokens(user._id, user.gymId),
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
    const user = await User.findOne({ email });

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate token
    const accessToken = jwt.sign(
      { id: user._id, gymId: user.gymId },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }, // Increased expiry for testing
    );

    // Set cookie with specific options
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // false in development
      sameSite: "lax", // Changed from 'strict' to 'lax'
      path: "/",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    logger.info("Cookie set:", {
      token: accessToken,
      cookieHeader: res.getHeader("Set-Cookie"),
    });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.user_type,
      permissions: user.permissions,
      gymId: user.gymId,
    });
  } catch (error) {
    logger.error("Login error:", error);
    res.status(500).json({ message: "Error logging in" });
  }
});

router.get("/session", async (req, res) => {
  try {
    const accessToken = req.cookies.accessToken;

    if (!accessToken) {
      return res.status(401).json({ authenticated: false });
    }

    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ authenticated: false });
    }

    res.json({
      authenticated: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.user_type,
        permissions: user.permissions,
        gymId: user.gymId,
      },
    });
  } catch (error) {
    logger.error("Session check error:", error);
    res.status(401).json({ authenticated: false });
  }
});

// Refresh token route
router.post("/refresh-token", async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ message: "No refresh token" });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || refreshTokens.get(user._id.toString()) !== refreshToken) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

    // Update stored refresh token
    refreshTokens.set(user._id.toString(), newRefreshToken);

    // Set new tokens in cookies
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ success: true });
  } catch (error) {
    logger.error("Token refresh error:", error);
    res.status(401).json({ message: "Invalid refresh token" });
  }
});

// Logout route
router.post("/logout", (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    // Remove refresh token from storage
    for (const [userId, token] of refreshTokens.entries()) {
      if (token === refreshToken) {
        refreshTokens.delete(userId);
        break;
      }
    }
  }

  // Clear cookies
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  res.json({ message: "Logged out successfully" });
});

// **Logout User**
router.post("/logout", protect, attachGym, async (req, res) => {
  try {
    res.clearCookie("token", { path: "/" });
    res.status(200).json({
      message:
        "Logged out successfully. Please remove token from local storage.",
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// **Get User Profile**
router.get("/profile", protect, attachGym, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password")
      .populate("gymId"); // This will populate all gym fields

    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// **Check User Role**
router.get("/check-role", protect, attachGym, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("user_type");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ role: user.user_type });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;
