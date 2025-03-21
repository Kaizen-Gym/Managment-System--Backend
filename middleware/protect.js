import jwt from "jsonwebtoken";
import logger from "../utils/logger.js";
import User from "../models/user.js";

const protect = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken;

    if (!token) {
      logger.warn("No token found in cookies");
      return res.status(401).json({ message: "Not authorized, please login" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
        logger.warn(`No user found with ID: ${decoded.id}`);
        return res.status(401).json({ message: "User not found" });
      }

      req.user = user;
      next();
    } catch (jwtError) {
      logger.error("JWT Verification Error:", jwtError);
      
      if (jwtError.name === "TokenExpiredError") {
        return res.status(401).json({ 
          message: "Session expired, please login again",
          error: "TOKEN_EXPIRED"
        });
      }

      return res.status(401).json({ 
        message: "Invalid session",
        error: jwtError.message
      });
    }
  } catch (error) {
    logger.error("Protect Middleware Error:", error);
    res.status(401).json({ 
      message: "Authentication failed",
      error: error.message
    });
  }
};

export default protect;