import express from 'express';
import Gym from '../models/gym.js';
import logger from '../utils/logger.js';

const router = express.Router();

// GET /api/utils/gyms
router.get('/gyms', async (req, res) => {
  try {
    const gyms = await Gym.find();
    res.json(gyms);
  } catch (error) {
    logger.error("Error fetching gyms", error.message);
    res.status(500).json({ message: 'Error fetching gyms' });
  }
});

export default router;