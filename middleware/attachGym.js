// middleware/attachGym.js
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import logger from "../utils/logger.js";
dotenv.config();

const attachGym = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.gymId = decoded.gymId;
      next();
    } catch (error) {
      logger.error(error);
      return res.status(401).json({ message: "Not authorized, invalid token" });
    }
  } else {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
};

export default attachGym;