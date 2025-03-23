import Trainer from "../models/trainer.js";
import express from "express";
import multer from "multer"; // Import multer
import sharp from "sharp";
import protect from "../middleware/protect.js";
import attachGym from "../middleware/attachGym.js";
import { handleError, AppError } from "../utils/errorHandler.js";
import logger from "../utils/logger.js";

const router = express.Router();

// Configure Multer for file uploads (in-memory storage)
const storage = multer.memoryStorage(); // Store the file in memory as a buffer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return cb(new Error("Please upload an image file"));
    }
    cb(null, true);
  },
});

router.post(
  "/trainer",
  protect,
  attachGym,
  upload.single("photo"),
  async (req, res) => {
    const {
      name,
      email,
      number,
      specialization,
      experience,
      certifications,
      schedule,
    } = req.body;

    if (
      !name ||
      !email ||
      !number ||
      !specialization ||
      experience === undefined ||
      !schedule
    ) {
      throw new AppError("All fields are required", 400);
    }

    try {
      const existingTrainer = await Trainer.findOne({
        number,
        email,
        gymId: req.gymId,
      });
      if (existingTrainer) {
        throw new AppError("A trainer with this email or number already exists", 409);
      }

      // Process photo upload
      let photoData = null;
      let photoContentType = null;
      if (req.file) {
        try {
          const processedImage = await sharp(req.file.buffer)
            .resize(500, 500, { fit: "inside" }) // Resize and maintain aspect ratio
            .jpeg({ quality: 80 }) // Optimize and convert to JPEG
            .toBuffer();

          photoData = processedImage;
          photoContentType = "image/jpeg"; // Or req.file.mimetype if you preserve original
        } catch (sharpError) {
          console.error("Error processing image with sharp:", sharpError);
          throw new AppError("Error processing image", 500);
        }
      }

      const newTrainer = new Trainer({
        name,
        email,
        number,
        specialization,
        experience,
        certifications,
        schedule,
        gymId: req.gymId,
        photo: { data: photoData, contentType: photoContentType },
      });

      await newTrainer.save();
      res.status(201).json(newTrainer);
    } catch (error) {
      handleError(error, req, res);
    }
  },
);

router.get("/trainers", protect, attachGym, async (req, res) => {
  try {
    const trainers = await Trainer.find({ gymId: req.gymId });
    logger.info(`Retrieved ${trainers.length} trainers for gym ${req.gymId}`);
    res.json(trainers);
  } catch (error) {
    logger.error(`Error retrieving trainers for gym ${req.gymId}: ${error.message}`);
    handleError(error, req, res)
  }
});

router.get("/trainer/:id", protect, attachGym, async (req, res) => {
  try {
    const trainer = await Trainer.findOne({
      _id: req.params.id,
      gymId: req.gymId,
    });
    if (!trainer) {
      throw new AppError("Trainer not found", 404);
    }
    logger.info(`Retrieved trainer ${trainer._id} for gym ${req.gymId}`);
    res.json(trainer);
  } catch (error) {
    handleError(error, req, res);
  }
});

router.put(
  "/trainer/:id",
  protect,
  attachGym,
  upload.single("photo"),
  async (req, res) => {
    try {
      const trainer = await Trainer.findOne({
        _id: req.params.id,
        gymId: req.gymId,
      });
      if (!trainer) {
        throw new AppError("Trainer not found", 404);
      }

      const {
        name,
        email,
        number,
        specialization,
        experience,
        certifications,
        schedule,
      } = req.body;

      if (name) trainer.name = name;
      if (email) trainer.email = email;
      if (number) trainer.number = number;
      if (specialization) trainer.specialization = specialization;
      if (experience !== undefined) trainer.experience = experience;
      if (certifications) trainer.certifications = certifications;
      if (schedule) trainer.schedule = schedule;

      // Process photo update
      if (req.file) {
        try {
          const processedImage = await sharp(req.file.buffer)
            .resize(500, 500, { fit: "inside" }) // Resize and maintain aspect ratio
            .jpeg({ quality: 80 }) // Optimize and convert to JPEG
            .toBuffer();

          trainer.photo = {
            data: processedImage,
            contentType: "image/jpeg", // Or req.file.mimetype
          };
        } catch (sharpError) {
          logger.error("Error processing image with sharp:", sharpError);
          throw new AppError("Error processing image", 500);
        }
      }

      await trainer.save();
      logger.info("Trainer updated successfully");
      res.json(trainer);
    } catch (error) {
      handleError(error, req, res);
    }
  },
);

router.delete("/trainer/:id", protect, attachGym, async (req, res) => {
  try {
    const trainer = await Trainer.findOne({
      _id: req.params.id,
      gymId: req.gymId,
    });
    if (!trainer) {
      throw new AppError("Trainer not found", 404);
    }

    await Trainer.deleteOne({ _id: trainer._id, gymId: req.gymId });
    res.json({ message: "Trainer removed" });
  } catch (error) {
    handleError(error, req, res);
  }
});

export default router;