import express from 'express';
import Attendance from '../models/attendance.js';
import protect from '../middleware/protect.js';
import Member from '../models/member.js';
import attachGym from '../middleware/attachGym.js';
import logger from '../utils/logger.js';
import { Mongoose } from 'mongoose';

const router = express.Router();

// POST /attendance/checkin
router.post('/attendance/checkin', protect, attachGym, async (req, res) => {
  try {
    const { number } = req.body;
    if (!number) return res.status(400).json({ message: 'Member number is required' });
    
    // Include gymId filter
    const member = await Member.findOne({ number, gymId: req.gymId });
    if (!member) return res.status(404).json({ message: 'Member not found' });
    
    const now = new Date();
    const tenMinutesInMs = 10 * 60 * 1000;
    
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Check if there's an attendance record for today with a checkOut within the last 10 minutes
    const existingAttendance = await Attendance.findOne({
      id: member.id,
      number,
      gymId: req.gymId,
      checkIn: { $gte: startOfDay, $lte: endOfDay },
      checkOut: { $exists: true }
    }).sort({ checkIn: -1 });
    
    if (existingAttendance && (now - existingAttendance.checkOut) <= tenMinutesInMs) {
      existingAttendance.checkOut = undefined;
      await existingAttendance.save();
      return res.status(200).json({ message: 'Attendance resumed', attendance: existingAttendance });
    }
    
    // Include gymId in the created record
    const attendance = await Attendance.create({ name: member.name, number, gymId: req.gymId, checkIn: now });
    res.status(201).json({ message: 'Check-in recorded', attendance });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /attendance/checkout
router.post('/attendance/checkout', protect, attachGym, async (req, res) => {
  try {
    const { number } = req.body;
    if (!number) return res.status(400).json({ message: 'Member number is required' });
    
    const member = await Member.findOne({ number, gymId: req.gymId });
    if (!member) return res.status(404).json({ message: 'Member not found' });
    
    const attendance = await Attendance.findOne({
      id: member.id,
      number,
      gymId: req.gymId,
      checkOut: { $exists: false }
    }).sort({ checkIn: -1 });
    
    if (!attendance) return res.status(404).json({ message: 'Active attendance record not found' });
    
    attendance.checkOut = new Date();
    await attendance.save();
    res.status(200).json({ message: 'Check-out recorded', attendance });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /attendance - retrieve all attendance records for the current gym
router.get('/attendance', protect, attachGym, async (req, res) => {
  try {
    const gymObjectId = Mongoose.Types.ObjectId(req.gymId); // if needed
    const attendances = await Attendance.find({ gymId: gymObjectId });
    logger.info('Retrieved all attendance records for Gym ID:', req.gymId);
    res.status(200).json({
      gymId: req.gymId,
      attendances: attendances
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// GET /attendance/:number - retrieve attendance records for a specific member in the current gym
router.get('/attendance/:number', protect, attachGym, async (req, res) => {
  try {
    const { number } = req.params;
    const attendances = await Attendance.find({ 
      number, 
      gymId: req.gymId 
    }).sort({ checkIn: -1 }); // Sort by check-in date desc

    // Return empty array if no records found instead of 404
    res.status(200).json(attendances);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;
