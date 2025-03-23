import express from 'express';
import Attendance from '../models/attendance.js';
import protect from '../middleware/protect.js';
import Member from '../models/member.js';
import attachGym from '../middleware/attachGym.js';
import logger from '../utils/logger.js';
import { Mongoose } from 'mongoose';
import { AppError, handleError } from '../utils/errorHandler.js';

const router = express.Router();

// POST /attendance/checkin
router.post('/attendance/checkin', protect, attachGym, async (req, res) => {
  try {
    const { number } = req.body;
    if (!number) {
      throw new AppError('Member number is required', 400);
    }
    
    const member = await Member.findOne({ number, gymId: req.gymId });
    if (!member) {
      throw new AppError('Member not found', 404);
    }
    
    const now = new Date();
    const tenMinutesInMs = 10 * 60 * 1000;
    
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    
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
      logger.info(`Attendance resumed for member ${number} at gym ${req.gymId}`);
      return res.status(200).json({ message: 'Attendance resumed', attendance: existingAttendance });
    }
    
    const attendance = await Attendance.create({ name: member.name, number, gymId: req.gymId, checkIn: now });
    logger.info(`New check-in recorded for member ${number} at gym ${req.gymId}`);
    res.status(201).json({ message: 'Check-in recorded', attendance });
  } catch (error) {
    handleError(error, req, res);
  }
});

// POST /attendance/checkout
router.post('/attendance/checkout', protect, attachGym, async (req, res) => {
  try {
    const { number } = req.body;
    if (!number) {
      throw new AppError('Member number is required', 400);
    }
    
    const member = await Member.findOne({ number, gymId: req.gymId });
    if (!member) {
      throw new AppError('Member not found', 404);
    }
    
    const attendance = await Attendance.findOne({
      id: member.id,
      number,
      gymId: req.gymId,
      checkOut: { $exists: false }
    }).sort({ checkIn: -1 });
    
    if (!attendance) {
      throw new AppError('Active attendance record not found', 404);
    }
    
    attendance.checkOut = new Date();
    await attendance.save();
    logger.info(`Check-out recorded for member ${number} at gym ${req.gymId}`);
    res.status(200).json({ message: 'Check-out recorded', attendance });
  } catch (error) {
    handleError(error, req, res);
  }
});

// GET /attendance
router.get('/attendance', protect, attachGym, async (req, res) => {
  try {
    const gymObjectId = Mongoose.Types.ObjectId(req.gymId);
    const attendances = await Attendance.find({ gymId: gymObjectId });
    logger.info(`Retrieved all attendance records for gym ${req.gymId}`);
    res.status(200).json({
      gymId: req.gymId,
      attendances: attendances
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// GET /attendance/:number
router.get('/attendance/:number', protect, attachGym, async (req, res) => {
  try {
    const { number } = req.params;
    const attendances = await Attendance.find({ 
      number, 
      gymId: req.gymId 
    }).sort({ checkIn: -1 });

    logger.info(`Retrieved attendance records for member ${number} at gym ${req.gymId}`);
    res.status(200).json(attendances);
  } catch (error) {
    handleError(error, req, res);
  }
});

export default router;