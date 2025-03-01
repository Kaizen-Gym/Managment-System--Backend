import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import member from '../models/member.js';
import Renew from '../models/renew.js';
import logger from '../utils/logger.js';
import protect from '../middleware/protect.js';
import attachGym from '../middleware/attachGym.js';
import MembershipPlan from '../models/membershipPlan.js';

const router = express.Router();

// 🔹 Helper function to validate request body
const validateRenewRequest = (body) => {
  const { number, membership_type, membership_amount, membership_payment_status, membership_payment_mode } = body;
  
  if (!number || !membership_type || !membership_amount || !membership_payment_status || !membership_payment_mode) {
    return { valid: false, message: "All required fields must be filled" };
  }

  const parsedAmount = Number(membership_amount);
  if (isNaN(parsedAmount)) {
    return { valid: false, message: "Membership amount must be a number" };
  }

  return { valid: true, parsedAmount };
};

// 🔹 Function to calculate new expiry date
const calculateNewExpiryDate = (currentExpiry, membership_type) => {
  let newExpiryDate = new Date(currentExpiry);
  if (membership_type === 'Monthly') newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);
  if (membership_type === 'Quarterly') newExpiryDate.setMonth(newExpiryDate.getMonth() + 3);
  if (membership_type === 'Yearly') newExpiryDate.setFullYear(newExpiryDate.getFullYear() + 1);
  return newExpiryDate;
};

// 🔹 Renew Membership
router.post('/renew', protect, attachGym, async (req, res) => {
  try {
    const { number, membership_type, membership_payment_status, membership_payment_mode } = req.body;
    const validation = validateRenewRequest(req.body);
    if (!validation.valid) return res.status(400).json({ message: validation.message });

    const parsedAmount = validation.parsedAmount;
    // Filter by both number and gymId
    const userExists = await member.findOne({ number, gymId: req.gymId })
    if (!userExists) return res.status(404).json({ message: "User does not exist" });

    const currentExpiry = userExists.membership_end_date && new Date(userExists.membership_end_date) > new Date()
      ? new Date(userExists.membership_end_date)
      : new Date();
    const newExpiryDate = calculateNewExpiryDate(currentExpiry, membership_type);

    // Update user membership details with gym filter
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
          membership_status: "Active"
        },
        $inc: { member_total_payment: parsedAmount }
      },
      { new: true }
    );

    // Create Renew record with gymId
    await Renew.create([{
      name: updatedMember.name,
      number,
      membership_type,
      membership_amount: parsedAmount,
      membership_payment_status,
      membership_payment_mode,
      membership_end_date: newExpiryDate,
      gymId: req.gymId
    }]);

    res.status(201).json({ message: "Membership renewed successfully" });

  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 🔹 Get all renew records for the current gym
router.get('/renew', protect, attachGym, async (req, res) => {
  try {
    const renewRecords = await Renew.find({ gymId: req.gymId });
    res.status(200).json(renewRecords);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 🔹 Get renew records for a specific user in the current gym
router.get('/renew/:number', protect, attachGym, async (req, res) => {
  try {
    const number = Number(req.params.number);
    const renewRecords = await Renew.find({ 
      number, 
      gymId: req.gymId 
    }).sort({ membership_payment_date: -1 }); // Sort by payment date desc

    // Return empty array if no records found instead of 404
    res.status(200).json(renewRecords);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 🔹 Delete a renew record for the current gym
router.delete('/renew/:id', protect, attachGym, async (req, res) => {
  try {
    const { id } = req.params;
    // Use findOne to ensure gymId filter is applied
    const renewRecord = await Renew.findOne({ _id: id, gymId: req.gymId });
    if (!renewRecord) {
      return res.status(404).json({ message: "Renew record not found" });
    }
    await Renew.deleteOne({ _id: id, gymId: req.gymId });
    res.status(200).json({ message: "Renew record deleted successfully" });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 🔹 Update a renew record for the current gym
router.put('/renew/:id', protect, attachGym, async (req, res) => {
  try {
    const { id } = req.params;
    // Use findOne to ensure gymId filter is applied
    const renewRecord = await Renew.findOne({ _id: id, gymId: req.gymId });
    if (!renewRecord) {
      return res.status(404).json({ message: "Renew record not found" });
    }

    const validation = validateRenewRequest(req.body);
    if (!validation.valid) return res.status(400).json({ message: validation.message });

    const parsedAmount = validation.parsedAmount;
    // Update renew record using a filter that includes gymId
    await Renew.findOneAndUpdate(
      { _id: id, gymId: req.gymId },
      {
        membership_type: req.body.membership_type,
        membership_amount: parsedAmount,
        membership_payment_status: req.body.membership_payment_status,
        membership_payment_mode: req.body.membership_payment_mode
      }
    );

    res.status(200).json({ message: "Renew record updated successfully" });

  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 🔹 Get all membership plans for the current gym 
router.get('/plans', protect, attachGym, async (req, res) => {
  try {
    const plans = await MembershipPlan.find({ gymId: req.gymId });
    res.status(200).json(plans);
  } catch (error) {
    logger.error('Error fetching membership plans:', error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 🔹 Create a new membership plan
router.post('/plans', protect, attachGym, async (req, res) => {
  try {
    const { name, duration, price, description, features } = req.body;

    // Validation
    if (!name || !duration || !price || !description) {
      return res.status(400).json({ 
        message: "Please provide name, duration, price, and description" 
      });
    }

    // Check if plan with same name exists
    const existingPlan = await MembershipPlan.findOne({ 
      name, 
      gymId: req.gymId 
    });
    
    if (existingPlan) {
      return res.status(400).json({ 
        message: "A plan with this name already exists" 
      });
    }

    const plan = await MembershipPlan.create({
      name,
      duration,
      price,
      description,
      features: features || [],
      gymId: req.gymId
    });

    res.status(201).json(plan);
  } catch (error) {
    logger.error('Error creating membership plan:', error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 🔹 Update a membership plan
router.put('/plans/:id', protect, attachGym, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, duration, price, description, features } = req.body;

    // Validation
    if (!name || !duration || !price || !description) {
      return res.status(400).json({ 
        message: "Please provide name, duration, price, and description" 
      });
    }

    // Check if plan exists and belongs to the gym
    const plan = await MembershipPlan.findOne({ 
      _id: id, 
      gymId: req.gymId 
    });

    if (!plan) {
      return res.status(404).json({ message: "Membership plan not found" });
    }

    // Check if another plan with the same name exists (excluding current plan)
    const existingPlan = await MembershipPlan.findOne({
      name,
      gymId: req.gymId,
      _id: { $ne: id }
    });

    if (existingPlan) {
      return res.status(400).json({ 
        message: "Another plan with this name already exists" 
      });
    }

    const updatedPlan = await MembershipPlan.findOneAndUpdate(
      { _id: id, gymId: req.gymId },
      {
        name,
        duration,
        price,
        description,
        features: features || []
      },
      { new: true }
    );

    res.status(200).json(updatedPlan);
  } catch (error) {
    logger.error('Error updating membership plan:', error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 🔹 Delete a membership plan
router.delete('/plans/:id', protect, attachGym, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if plan exists and belongs to the gym
    const plan = await MembershipPlan.findOne({ 
      _id: id, 
      gymId: req.gymId 
    });

    if (!plan) {
      return res.status(404).json({ message: "Membership plan not found" });
    }

    await MembershipPlan.deleteOne({ _id: id, gymId: req.gymId });

    res.status(200).json({ 
      message: "Membership plan deleted successfully" 
    });
  } catch (error) {
    logger.error('Error deleting membership plan:', error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});



export default router;
