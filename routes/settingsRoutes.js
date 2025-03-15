import express from 'express';
import protect from '../middleware/protect.js';
import attachGym from '../middleware/attachGym.js';
import Settings from '../models/settings.js'; // You'll need to create this model
import logger from '../utils/logger.js';

const router = express.Router();

// Get settings
router.get('/settings', protect, attachGym, async (req, res) => {
  try {
    const settings = await Settings.findOne({ gymId: req.gymId });
    res.json(settings || {});
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update settings
router.put('/settings', protect, attachGym, async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      { gymId: req.gymId },
      req.body,
      { new: true, upsert: true }
    );
    res.json(settings);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Backup database
router.post('/settings/backup', protect, attachGym, async (req, res) => {
  try {
    // Implement your backup logic here
    res.json({ message: 'Backup initiated successfully' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Clear logs
router.delete('/settings/logs', protect, attachGym, async (req, res) => {
  try {
    // Implement your log clearing logic here
    res.json({ message: 'Logs cleared successfully' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;