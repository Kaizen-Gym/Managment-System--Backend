import express from "express";
import mongoose from "mongoose";
import logger from "./utils/logger.js";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// Import routers
import authRoutes from "./routes/authRoutes.js";
import memberRouter from "./routes/memberRoutes.js";
import trainerRoutes from "./routes/trainerRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import membershipRoutes from "./routes/membershipRoutes.js";
import attendanceRoutes from "./routes/attendenceRoutes.js";
import utilsRoutes from "./routes/utilsRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import roleRoutes from "./routes/roleRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";

// utils
import { initializeScheduledTasks } from "./utils/scheduler.js";

// Connect to the database
try {
  logger.info("Connecting to the database...");
  await mongoose.connect(process.env.MongoDB, {});
  await initializeScheduledTasks();
} catch (error) {
  logger.error("Error connecting to the database: ", error);
  process.exit(1);
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // Allow any localhost origin dynamically (both HTTP and HTTPS)
    const isLocalhost = /^(http|https):\/\/localhost:\d+$/.test(origin);
    if (isLocalhost) {
      return callback(null, true);
    }

    // In production, restrict to specific origins
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : [];
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

const app = express();

// Apply CORS middleware with options
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Custom headers middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Credentials", true);
  res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Content-Length, X-Requested-With, Accept, Origin",
  );
  next();
});

// Handle OPTIONS preflight requests
app.options("*", cors(corsOptions));

// -------------------------
// API Routes
// -------------------------
app.use("/api/auth", authRoutes);
app.use("/api/member", memberRouter);
app.use("/api", trainerRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/memberships", membershipRoutes);
app.use("/api", attendanceRoutes);
app.use("/api/utils", utilsRoutes);
app.use("/api", userRoutes);
app.use("/api", roleRoutes);
app.use("/api", settingsRoutes);

// Catch-all for undefined API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({ message: "API endpoint not found" });
});

// -------------------------
// Serve Frontend in Production
// -------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "build")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "build", "index.html"));
  });
}

// -------------------------
// Start the Server
// -------------------------
app.listen(5050, () => {
  logger.info("Server is running on http://localhost:5050");
});
