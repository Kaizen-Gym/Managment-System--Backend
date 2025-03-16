import express from 'express';
import Gym from '../models/gym.js';
import logger from '../utils/logger.js';
import protect from "../middleware/protect.js";
import attachGym from "../middleware/attachGym.js";

const router = express.Router();

// GET /api/utils/gyms
router.get('/gyms', protect, attachGym, async (req, res) => {
  try {
    const gyms = await Gym.find();
    res.json(gyms);
    console.log(gyms);
  } catch (error) {
    logger.error("Error fetching gyms", error.message);
    res.status(500).json({ message: 'Error fetching gyms' });
  }
});

router.get('/gym', protect, async (req, res) => {
  try {
    const gym = await Gym.findOne({ gymId: req.gymId });
    
    if (!gym) {
      return res.status(404).json({ message: 'Gym not found' });
    }
    
    res.json(gym);
    logger.info(`Gym ${gym.name} fetched successfully`);
  } catch (error) {
    logger.error("Error fetching gym", error.message);
    res.status(500).json({ message: 'Error fetching gym' });
  }
});

router.put('/gym', protect, attachGym, async (req, res) => {
  try {
    const { name, address } = req.body;
    
    const gym = await Gym.findByIdAndUpdate(
      req.gymId,
      { name, address },
      { new: true }
    );
    
    if (!gym) {
      return res.status(404).json({ message: 'Gym not found' });
    }
    
    res.json(gym);
    logger.info(`Gym ${gym.name} updated successfully`);
  } catch (error) {
    logger.error("Error updating gym", error.message);
    res.status(500).json({ message: 'Error updating gym' });
  }
});

export default router;