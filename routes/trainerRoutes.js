import Trainer from "../models/trainer.js";
import express from "express";
import protect from "../middleware/protect.js";
import attachGym from "../middleware/attachGym.js";

const router = express.Router();

router.post("/trainer", protect, attachGym, async (req, res) => {
  const {
    name,
    email,
    number,
    address,
    specialization,
    experience,
    certifications,
    schedule,
  } = req.body;

  if (
    !name ||
    !email ||
    !number ||
    !address ||
    !specialization ||
    experience === undefined ||
    !schedule
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const existingTrainer = await Trainer.findOne({ number, email, gymId: req.gymId});
    if (existingTrainer) {
      return res.status(409).json({
        message: "A trainer with this email or number number already exists",
      });
    }

    const newTrainer = new Trainer({
      name,
      email,
      number,
      address,
      specialization,
      experience,
      certifications,
      schedule,
      gymId: req.gymId
    });

    await newTrainer.save();
    res.status(201).json(newTrainer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get("/trainers", protect, attachGym, async (req, res) => {
  try {
    const trainers = await Trainer.find({gymId: req.gymId});
    res.json(trainers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get("/trainer/:id", protect, attachGym, async (req, res) => {
  try {
    const trainer = await Trainer.findOne({ _id: req.params.id, gymId: req.gymId });
    if (!trainer) {
      return res.status(404).json({ message: "Trainer not found" });
    }
    res.json(trainer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.put("/trainer/:id", protect, attachGym, async (req, res) => {
  try {
    const trainer = await Trainer.findOne({ _id: req.params.id, gymId: req.gymId });
    if (!trainer) {
      return res.status(404).json({ message: "Trainer not found" });
    }

    const {
      name,
      email,
      number,
      address,
      specialization,
      experience,
      certifications,
      schedule,
    } = req.body;

    if (name) trainer.name = name;
    if (email) trainer.email = email;
    if (number) trainer.number = number;
    if (address) trainer.address = address;
    if (specialization) trainer.specialization = specialization;
    if (experience !== undefined) trainer.experience = experience;
    if (certifications) trainer.certifications = certifications;
    if (schedule) trainer.schedule = schedule;

    await trainer.save();
    res.json(trainer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.delete("/trainer/:id", protect, attachGym, async (req, res) => {
  try {
    const trainer = await Trainer.findOne({ _id: req.params.id, gymId: req.gymId });
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
