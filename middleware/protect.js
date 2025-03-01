import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import env from 'dotenv';
import User from '../models/user.js';
env.config();

const protect = async (req, res, next) => {
    // Check for authorization header and extract the token
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        token = req.headers.authorization.split(" ")[1]?.trim(); // ensure token is trimmed
    }

    // If no token was provided, return 401
    if (!token) {
        logger.error("Not authorized, no token provided");
        return res.status(402).json({ message: "Not authorized, no token provided" });
    }

    // Verify the token
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(404).json({ message: "Not authorized" });
        }

        req.user = user;
        next();
    } catch (error) {
        logger.error("Not authorized, token failed", error);
        return res.status(401).json({ message: "Not authorized, token failed" });
    }
};

export default protect;
