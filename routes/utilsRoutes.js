import express from "express";
import Gym from "../models/gym.js";
import logger from "../utils/logger.js";
import protect from "../middleware/protect.js";
import attachGym from "../middleware/attachGym.js";
import Member from "../models/member.js";

const router = express.Router();

// GET /api/utils/gyms
router.get("/gyms", protect, attachGym, async (req, res) => {
  try {
    const gyms = await Gym.find();
    res.json(gyms);
    console.log(gyms);
  } catch (error) {
    logger.error("Error fetching gyms", error.message);
    res.status(500).json({ message: "Error fetching gyms" });
  }
});

router.get("/gym", protect, async (req, res) => {
  try {
    const gym = await Gym.findOne({ gymId: req.gymId });

    if (!gym) {
      return res.status(404).json({ message: "Gym not found" });
    }

    res.json(gym);
    logger.info(`Gym ${gym.name} fetched successfully`);
  } catch (error) {
    logger.error("Error fetching gym", error.message);
    res.status(500).json({ message: "Error fetching gym" });
  }
});

router.put("/gym", protect, attachGym, async (req, res) => {
  try {
    const { name, address } = req.body;

    const gym = await Gym.findByIdAndUpdate(
      req.gymId,
      { name, address },
      { new: true },
    );

    if (!gym) {
      return res.status(404).json({ message: "Gym not found" });
    }

    res.json(gym);
    logger.info(`Gym ${gym.name} updated successfully`);
  } catch (error) {
    logger.error("Error updating gym", error.message);
    res.status(500).json({ message: "Error updating gym" });
  }
});

router.post("/search", protect, attachGym, async (req, res) => {
  try {
    console.log("Received body:", req.body);

    const { searchTerm } = req.body;

    if (!searchTerm) {
      return res.status(400).json({ message: "Search term is required" });
    }

    // First, let's try to find the member directly by phone number to verify it exists
    const directPhoneCheck = await Member.findOne({ 
      gymId: req.gymId,
      phone: searchTerm 
    });
    console.log("Direct phone check result:", directPhoneCheck);

    const query = {
      gymId: req.gymId,
      $or: [
        { name: { $regex: searchTerm, $options: "i" } },
        { email: { $regex: searchTerm, $options: "i" } },
        { number: searchTerm }, // Exact match
        { number: { $regex: searchTerm, $options: "i" } } // Regex match
      ],
    };

    console.log("Search query:", JSON.stringify(query, null, 2));

    const members = await Member.find(query);
    console.log("Search results:", members);

    // Let's also check all members to see how the phone numbers are stored
    const allMembers = await Member.find({ gymId: req.gymId });
    console.log("All members phone numbers:", allMembers.map(m => m.phone));

    res.json(members);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ message: "Error searching members" });
  }
});

export default router;
