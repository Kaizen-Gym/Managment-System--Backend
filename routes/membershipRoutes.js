import dotenv from "dotenv";
dotenv.config();
import express from "express";
import member from "../models/member.js";
import Renew from "../models/renew.js";
import logger from "../utils/logger.js";
import protect from "../middleware/protect.js";
import attachGym from "../middleware/attachGym.js";
import MembershipPlan from "../models/membershipPlan.js";
import moment from "moment";
import { AppError, handleError } from '../utils/errorHandler.js';

const router = express.Router();

// Helper functions
const validateRenewRequest = (body) => {
  const { number, membership_type, membership_amount, membership_payment_status, membership_payment_mode } = body;

  if (!number || !membership_type || !membership_amount || !membership_payment_status || !membership_payment_mode) {
    throw new AppError('All required fields must be filled', 400);
  }

  const parsedAmount = Number(membership_amount);
  if (isNaN(parsedAmount)) {
    throw new AppError('Membership amount must be a number', 400);
  }

  return { valid: true, parsedAmount };
};

const calculateNewExpiryDate = async (currentExpiry, membershipType, gymId) => {
  const planUsed = await MembershipPlan.findOne({ name: membershipType, gymId });
  if (!planUsed) {
    throw new AppError(`Membership plan not found: ${membershipType}`, 404);
  }

  const durationMonths = parseInt(planUsed.duration, 10);
  if (isNaN(durationMonths)) {
    throw new AppError(`Invalid plan duration: ${planUsed.duration}`, 400);
  }

  logger.info(`Calculating new expiry date: ${durationMonths} months from ${currentExpiry}`);
  return moment(currentExpiry).add(durationMonths, "months").toDate();
};

// Renew Membership
router.post("/renew", protect, attachGym, async (req, res) => {
  try {
    const { number, membership_type, membership_amount, membership_due_amount, 
            membership_payment_status, membership_payment_mode } = req.body;

    if (!number || !membership_type || membership_amount === undefined) {
      throw new AppError('All required fields must be filled', 400);
    }

    const parsedAmount = Number(membership_amount);
    const parsedDueAmount = Number(membership_due_amount || 0);

    if (isNaN(parsedAmount) || isNaN(parsedDueAmount)) {
      throw new AppError('Invalid amount values', 400);
    }

    const existingMember = await member.findOne({ number, gymId: req.gymId });
    if (!existingMember) {
      throw new AppError('Member not found', 404);
    }

    const currentExpiry = existingMember.membership_end_date && 
                         new Date(existingMember.membership_end_date) > new Date()
                         ? new Date(existingMember.membership_end_date)
                         : new Date();

    const newExpiryDate = await calculateNewExpiryDate(currentExpiry, membership_type, req.gymId);

    const updatedMember = await member.findOneAndUpdate(
      { number, gymId: req.gymId },
      {
        $set: {
          membership_type,
          membership_amount: parsedAmount,
          membership_payment_status,
          membership_payment_date: new Date(),
          membership_payment_mode,
          membership_end_date: newExpiryDate,
          membership_status: "Active",
          member_total_due_amount: parsedDueAmount,
        },
        $inc: { member_total_payment: parsedAmount - parsedDueAmount },
      },
      { new: true }
    );

    await Renew.create({
      name: existingMember.name,
      number,
      membership_type,
      membership_amount: parsedAmount,
      membership_due_amount: parsedDueAmount,
      membership_payment_status,
      membership_payment_mode,
      membership_end_date: newExpiryDate,
      gymId: req.gymId,
    });

    logger.info(`Membership renewed for member ${number} at gym ${req.gymId}`);
    res.status(201).json({
      message: "Membership renewed successfully",
      member: updatedMember,
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// Get all renew records
router.get("/renew", protect, attachGym, async (req, res) => {
  try {
    const renewRecords = await Renew.find({ gymId: req.gymId });
    logger.info(`Retrieved ${renewRecords.length} renew records for gym ${req.gymId}`);
    res.status(200).json(renewRecords);
  } catch (error) {
    handleError(error, req, res);
  }
});

// Get specific member's renew records
router.get("/renew/:number", protect, attachGym, async (req, res) => {
  try {
    const number = Number(req.params.number);
    const renewRecords = await Renew.find({ number, gymId: req.gymId })
                                  .sort({ membership_payment_date: -1 });
    
    logger.info(`Retrieved renew records for member ${number} at gym ${req.gymId}`);
    res.status(200).json(renewRecords);
  } catch (error) {
    handleError(error, req, res);
  }
});

// Delete renew record
router.delete("/renew/:id", protect, attachGym, async (req, res) => {
  try {
    const { id } = req.params;
    const renewRecord = await Renew.findOne({ _id: id, gymId: req.gymId });
    
    if (!renewRecord) {
      throw new AppError('Renew record not found', 404);
    }

    await Renew.deleteOne({ _id: id, gymId: req.gymId });
    logger.info(`Deleted renew record ${id} from gym ${req.gymId}`);
    res.status(200).json({ message: "Renew record deleted successfully" });
  } catch (error) {
    handleError(error, req, res);
  }
});

// Update renew record
router.put("/renew/:id", protect, attachGym, async (req, res) => {
  try {
    const { id } = req.params;
    const renewRecord = await Renew.findOne({ _id: id, gymId: req.gymId });
    
    if (!renewRecord) {
      throw new AppError('Renew record not found', 404);
    }

    const validation = validateRenewRequest(req.body);
    const updatedRecord = await Renew.findOneAndUpdate(
      { _id: id, gymId: req.gymId },
      {
        membership_type: req.body.membership_type,
        membership_amount: validation.parsedAmount,
        membership_payment_status: req.body.membership_payment_status,
        membership_payment_mode: req.body.membership_payment_mode,
      },
      { new: true }
    );

    logger.info(`Updated renew record ${id} at gym ${req.gymId}`);
    res.status(200).json({
      message: "Renew record updated successfully",
      record: updatedRecord
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// Get membership plans
router.get("/plans", protect, attachGym, async (req, res) => {
  try {
    const plans = await MembershipPlan.find({ gymId: req.gymId });
    logger.info(`Retrieved ${plans.length} membership plans for gym ${req.gymId}`);
    res.status(200).json(plans);
  } catch (error) {
    handleError(error, req, res);
  }
});

// Create membership plan
router.post("/plans", protect, attachGym, async (req, res) => {
  try {
    const { name, duration, price, description, features } = req.body;

    if (!name || !duration || !price || !description) {
      throw new AppError('Please provide name, duration, price, and description', 400);
    }

    const existingPlan = await MembershipPlan.findOne({ name, gymId: req.gymId });
    if (existingPlan) {
      throw new AppError('A plan with this name already exists', 400);
    }

    const plan = await MembershipPlan.create({
      name, duration, price, description,
      features: features || [],
      gymId: req.gymId,
    });

    logger.info(`Created new membership plan: ${name} for gym ${req.gymId}`);
    res.status(201).json(plan);
  } catch (error) {
    handleError(error, req, res);
  }
});

// Update membership plan
router.put("/plans/:id", protect, attachGym, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, duration, price, description, features } = req.body;

    if (!name || !duration || !price || !description) {
      throw new AppError('Please provide name, duration, price, and description', 400);
    }

    const plan = await MembershipPlan.findOne({ _id: id, gymId: req.gymId });
    if (!plan) {
      throw new AppError('Membership plan not found', 404);
    }

    const existingPlan = await MembershipPlan.findOne({
      name,
      gymId: req.gymId,
      _id: { $ne: id },
    });

    if (existingPlan) {
      throw new AppError('Another plan with this name already exists', 400);
    }

    const updatedPlan = await MembershipPlan.findOneAndUpdate(
      { _id: id, gymId: req.gymId },
      { name, duration, price, description, features: features || [] },
      { new: true }
    );

    logger.info(`Updated membership plan ${id} at gym ${req.gymId}`);
    res.status(200).json(updatedPlan);
  } catch (error) {
    handleError(error, req, res);
  }
});

// Delete membership plan
router.delete("/plans/:id", protect, attachGym, async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await MembershipPlan.findOne({ _id: id, gymId: req.gymId });
    
    if (!plan) {
      throw new AppError('Membership plan not found', 404);
    }

    await MembershipPlan.deleteOne({ _id: id, gymId: req.gymId });
    logger.info(`Deleted membership plan ${id} from gym ${req.gymId}`);
    res.status(200).json({ message: "Membership plan deleted successfully" });
  } catch (error) {
    handleError(error, req, res);
  }
});

// Process due payment
router.post("/pay-due", protect, attachGym, async (req, res) => {
  try {
    const { number, amount_paid, payment_mode } = req.body;

    if (!number || !amount_paid || !payment_mode) {
      throw new AppError('Please provide member number, amount paid, and payment mode', 400);
    }

    const parsedAmount = Number(amount_paid);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new AppError('Amount paid must be a positive number', 400);
    }

    const memberRecord = await member.findOne({ number, gymId: req.gymId });
    if (!memberRecord) {
      throw new AppError('Member not found', 404);
    }

    if (!memberRecord.member_total_due_amount || memberRecord.member_total_due_amount <= 0) {
      throw new AppError('Member has no due amount', 400);
    }

    if (parsedAmount > memberRecord.member_total_due_amount) {
      throw new AppError('Payment amount cannot be more than due amount', 400);
    }

    const remainingDueAmount = memberRecord.member_total_due_amount - parsedAmount;

    // Update member record: now also update the payment status based on the remaining due amount.
    // Update member record without storing the result
    await member.findOneAndUpdate(
      { number, gymId: req.gymId },
      {
        $set: {
          member_total_due_amount: remainingDueAmount,
          membership_payment_status: remainingDueAmount > 0 ? "Pending" : "Paid",
          last_due_payment_date: new Date(),
          last_due_payment_amount: parsedAmount,
        },
      },
      { new: true },
    );

    await Renew.create({
      name: memberRecord.name,
      number,
      membership_type: memberRecord.membership_type,
      membership_amount: parsedAmount,
      membership_due_amount: remainingDueAmount,
      membership_payment_status: "Paid",
      membership_payment_mode: payment_mode,
      membership_end_date: memberRecord.membership_end_date,
      gymId: req.gymId,
      is_due_payment: true,
      payment_type: "Due Payment",
    });

    logger.info(`Processed due payment of ${parsedAmount} for member ${number} at gym ${req.gymId}`);
    res.status(200).json({
      message: "Due payment processed successfully",
      remaining_due: remainingDueAmount,
      payment_details: {
        amount_paid: parsedAmount,
        payment_date: new Date(),
        payment_mode,
      },
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

export default router;