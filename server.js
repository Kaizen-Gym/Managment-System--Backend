import express from "express";
import mongoose from "mongoose";
import logger from "./utils/logger.js";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

//import router
import authRoutes from "./routes/authRoutes.js";
import memberRouter from "./routes/memberRoutes.js";
import trainerRoutes from "./routes/trainerRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import membershipRoutes from "./routes/membershipRoutes.js";
import attendanceRoutes from "./routes/attendenceRoutes.js";
import utilsRoutes from "./routes/utilsRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import roleRoutes from "./routes/roleRoutes.js";

// connect to the database
try {
  logger.info("Connecting to the database...");
  await mongoose.connect(process.env.MongoDB, {});
} catch (error) {
  logger.error("Error connecting to the database: ", error);
  process.exit(1);
}

const corsOptions = {
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173','http://localhost:5174', 'http://localhost:5174/dashboard', 'http://localhost:5052'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

// create an express application
const app = express();

// Apply CORS middleware with options to all routes
app.use(cors(corsOptions));  // Add this line!

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add custom headers middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', true);
  res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Accept, Origin');
  next();
});

// Handle OPTIONS preflight requests
app.options('*', cors(corsOptions));

//Routes
app.use("/api/auth", authRoutes);
app.use("/api/member", memberRouter);
app.use("/api", trainerRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/memberships", membershipRoutes);
app.use("/api", attendanceRoutes);
app.use("/api/utils", utilsRoutes);
app.use("/api", userRoutes);
app.use("/api", roleRoutes);

// start the server
app.listen(5050, () => {
  logger.info("Server is running on http://localhost:5050");
});
