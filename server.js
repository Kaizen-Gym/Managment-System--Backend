import express from "express";
import mongoose from "mongoose";
import logger from "./utils/logger.js";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import csrfProtection from "./middleware/csrf.js";

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
import logRoutes from "./routes/logRoutes.js";

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

const isDevelopment = process.env.NODE_ENV !== "production";

const corsOptions = {
  origin: isDevelopment ? ['http://localhost:5173'] : [process.env.FRONTEND_URL],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-CSRF-Token',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  exposedHeaders: ['X-CSRF-Token'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

const app = express();

// Cookie Parser Middleware
app.use(cookieParser(process.env.COOKIE_SECRET));


// app.use((req, res, next) => {
//   res.header("Access-Control-Allow-Credentials", "true");
//   res.header(
//     "Access-Control-Allow-Headers",
//     "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token"
//   );
//   res.header(
//     "Access-Control-Allow-Methods",
//     "GET, POST, PUT, DELETE, OPTIONS, PATCH"
//   );
  
//   if (req.method === "OPTIONS") {
//     return res.status(200).end();
//   }
//   next();
// });

// Apply CORS middleware with options
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply CSRF protection BEFORE the token endpoint
app.use(csrfProtection);

// CSRF Token endpoint
app.get('/api/csrf-token', (req, res) => {
  // Now req.csrfToken() will be available
  const token = req.csrfToken();
  res.cookie('XSRF-TOKEN', token, {
    secure: !isDevelopment,
    sameSite: isDevelopment ? 'lax' : 'strict',
    httpOnly: false
  });
  res.json({ csrfToken: token });
});

// Handle OPTIONS preflight requests
app.options("*", cors(corsOptions));

// CSRF error handler
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      message: 'Invalid CSRF token',
      csrf: false
    });
  }
  next(err);
});

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
app.use('/api/logs', logRoutes)

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
// Error Handling Middleware
// -------------------------
// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! Shutting down...');
  logger.error(err.name, err.message);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...');
  logger.error(err.name, err.message);
  process.exit(1);
});

// -------------------------
// Start the Server
// -------------------------
app.listen(5050, () => {
  logger.info("Server is running on http://localhost:5050");
});
