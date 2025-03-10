import Trainer from "../models/trainer.js";
import express from "express";
import multer from "multer"; // Import multer
import sharp from "sharp";
import protect from "../middleware/protect.js";
import attachGym from "../middleware/attachGym.js";

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
      return res.status(400).json({ message: "All fields are required" });
    }

    try {
      const existingTrainer = await Trainer.findOne({
        number,
        email,
        gymId: req.gymId,
      });
      if (existingTrainer) {
        return res.status(409).json({
          message: "A trainer with this email or number number already exists",
        });
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
          return res.status(500).json({ message: "Error processing image" });
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
      console.error(error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },
);

router.get("/trainers", protect, attachGym, async (req, res) => {
  try {
    const trainers = await Trainer.find({ gymId: req.gymId });
    res.json(trainers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get("/trainer/:id", protect, attachGym, async (req, res) => {
  try {
    const trainer = await Trainer.findOne({
      _id: req.params.id,
      gymId: req.gymId,
    });
    if (!trainer) {
      return res.status(404).json({ message: "Trainer not found" });
    }
    res.json(trainer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
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
        return res.status(404).json({ message: "Trainer not found" });
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
          console.error("Error processing image with sharp:", sharpError);
          return res.status(500).json({ message: "Error processing image" });
        }
      }

      await trainer.save();
      res.json(trainer);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error", error: error.message });
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
      return res.status(404).json({ message: "Trainer not found" });
    }

    await Trainer.deleteOne({ _id: trainer._id, gymId: req.gymId });
    res.json({ message: "Trainer removed" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;