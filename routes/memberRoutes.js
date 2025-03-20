import express from "express";
import multer from "multer";
import sharp from "sharp";
import logger from "../utils/logger.js";
import member from "../models/member.js";
import Renew from "../models/renew.js";
import protect from "../middleware/protect.js";
import attachGym from "../middleware/attachGym.js";
import mongoose from "mongoose";
import moment from "moment";

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

// POST /signup - Create a new member and corresponding renew record
router.post(
  "/signup",
  protect,
  attachGym,
  upload.single("photo"), // 'photo' is the field name in the form
  async (req, res) => {
    try {
      const {
        name,
        number,
        gender,
        age,
        email,
        membership_type,
        membership_amount,
        membership_due_amount,
        membership_payment_status,
        membership_payment_mode,
        membership_payment_date,
      } = req.body;

      if (
        ![
          name,
          number,
          gender,
          age,
          membership_type,
          membership_amount,
          membership_payment_status,
          membership_payment_mode,
          membership_payment_date,
        ].every(Boolean)
      ) {
        return res
          .status(400)
          .json({ message: "All required fields must be filled" });
      }

      // Check if user exists in the current gym
      if (await member.exists({ number, email, gymId: req.gymId })) {
        return res.status(409).json({ message: "User already exists" });
      }

      const parsedAmount = Number(membership_amount);
      const parseddueamount = Number(membership_due_amount);
      logger.info(
        `Membership amount: ${parsedAmount}, Due amount: ${parseddueamount}`,
      );
      if (isNaN(parsedAmount) || isNaN(parseddueamount)) {
        return res.status(400).json({
          message: "Membership amount and due amount must be numbers",
        });
      }

      const paidamount = parsedAmount - parseddueamount;

      const currentDate = new Date();
      const membership_start_date = new Date(membership_payment_date);

      if (isNaN(membership_start_date.getTime())) {
        return res.status(400).json({
          message: "Invalid membership payment date format",
        });
      }

      // Calculate expiry date based on membership type
      const membershipDurations = { Monthly: 1, Quarterly: 3, Yearly: 12 };
      const membership_duration = membershipDurations[membership_type] || 1;
      const membership_end_date = new Date(membership_start_date);
      membership_end_date.setMonth(
        membership_end_date.getMonth() + membership_duration,
      );

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
          logger.error("Error processing image with sharp:", sharpError);
          return res.status(500).json({ message: "Error processing image" });
        }
      }

      // check if the end date is before the current date and if it is then the status is "Inactive"
      let membership_status;
      if (membership_end_date < new Date()) {
        membership_status = "Expired";
      } else {
        membership_status = "Active";
      }

      // Create member record with gymId
      await member.create({
        name,
        gender,
        age,
        number,
        email: email || null,
        membership_type,
        membership_amount: parsedAmount,
        membership_due_amount: parseddueamount, // Add this field
        member_total_due_amount: parseddueamount, // And this for consistency
        member_total_payment: paidamount,
        membership_payment_status,
        membership_start_date,
        membership_payment_date: currentDate,
        membership_payment_mode,
        membership_end_date,
        membership_status,
        membership_duration,
        gymId: req.gymId,
        photo: { data: photoData, contentType: photoContentType }, // Save the processed image
      });

      // Create corresponding Renew record with gymId
      await Renew.create({
        name,
        number,
        membership_type,
        membership_amount: parsedAmount,
        membership_due_amount: parseddueamount,
        membership_payment_status,
        membership_payment_mode,
        membership_end_date,
        gymId: req.gymId,
      });

      res.status(201).json({ message: "User created successfully" });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },
);

// ----- GET endpoints for Members -----

// Get all members for the current gym (with pagination)
router.get("/members", protect, attachGym, async (req, res) => {
  if (!req.gymId) {
    return res.status(400).json({ message: "Gym ID is required" });
  }
  try {
    let { page = 1, limit = 10, status = 'all' } = req.query;
    page = Math.max(parseInt(page, 10), 1);
    limit = Math.max(parseInt(limit, 10), 1);

    const filter = { gymId: req.gymId };
    if (status !== "all") {
      filter.membership_status = new RegExp(`^${status}$`, 'i');
    }

    const members = await member
      .find(filter)
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await member.countDocuments(filter);

    res.status(200).json({
      members,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get a single member by phone number for the current gym
router.get("/members/:number", protect, attachGym, async (req, res) => {
  if (!req.gymId) {
    return res.status(400).json({ message: "Gym ID is required" });
  }
  try {
    const { number } = req.params;
    const memberInfo = await member.findOne({ number, gymId: req.gymId });
    if (!memberInfo) {
      return res.status(404).json({ message: "User does not exist" });
    }
    res.status(200).json(memberInfo);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// DELETE a member by phone number for the current gym
router.delete("/members/:number", protect, attachGym, async (req, res) => {
  try {
    const { number } = req.params;
    const userExists = await member.findOne({ number, gymId: req.gymId });
    if (!userExists) {
      return res.status(404).json({ message: "User does not exist" });
    }
    await member.findOneAndDelete({ number, gymId: req.gymId });
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    logger.error("Error deleting member:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// PUT /api/member/members/:number - UPDATE a member by phone number for the current gym
// PUT /members/:number - Update a member (including photo)
router.put(
  "/members/:number",
  protect,
  attachGym,
  upload.single("photo"), // 'photo' field
  async (req, res) => {
    try {
      const { number } = req.params;
      const userExists = await member.findOne({ number, gymId: req.gymId });
      if (!userExists) {
        return res.status(404).json({ message: "User does not exist" });
      }

      const updateData = req.body;
      let newPaymentAmount;
      let parsedAmount = 0;

      // Determine remaining due amount based on the provided payment status.
      // If the status is set to 'Paid', force due amount to 0.
      let remainingDueAmount;
      if (
        updateData.membership_payment_status &&
        updateData.membership_payment_status.toLowerCase() === "paid"
      ) {
        remainingDueAmount = 0;
      } else {
        // Use the passed membership_due_amount if provided; otherwise fallback to the existing due amount.
        remainingDueAmount =
          updateData.membership_due_amount !== undefined
            ? Number(updateData.membership_due_amount)
            : userExists.member_total_due_amount;
      }

      // If membership_amount is updated
      if (updateData.membership_amount !== undefined) {
        updateData.membership_amount = Number(updateData.membership_amount);
        if (isNaN(updateData.membership_amount)) {
          return res
            .status(400)
            .json({ message: "Membership amount must be a number" });
        }
        newPaymentAmount = updateData.membership_amount;
        parsedAmount = newPaymentAmount;

        // Adjust total payment: remove previous payment and add the new one
        updateData.member_total_payment =
          userExists.member_total_payment -
          userExists.membership_amount +
          newPaymentAmount;
      }

      // If membership_type is updated, recalc expiry and related fields
      if (
        updateData.membership_type !== undefined &&
        updateData.membership_type !== userExists.membership_type
      ) {
        const MembershipPlan = mongoose.model("MembershipPlan");
        const plan = await MembershipPlan.findOne({
          name: updateData.membership_type,
          gymId: req.gymId,
        });
        if (plan) {
          updateData.membership_amount = plan.price;
          updateData.membership_duration = plan.duration;
          // Determine a start date: either use the provided one or fallback to the existing one
          const startDate = new Date(
            updateData.membership_start_date ||
              userExists.membership_start_date,
          );
          const endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + plan.duration);
          updateData.membership_end_date = endDate;
        } else {
          return res.status(400).json({ message: "Invalid membership type" });
        }
      }

      // Process photo update
      if (req.file) {
        try {
          const processedImage = await sharp(req.file.buffer)
            .resize(500, 500, { fit: "inside" }) // Resize and maintain aspect ratio
            .jpeg({ quality: 80 }) // Optimize and convert to JPEG
            .toBuffer();

          updateData.photo = {
            data: processedImage,
            contentType: "image/jpeg", // Or req.file.mimetype
          };
        } catch (sharpError) {
          logger.error("Error processing image with sharp:", sharpError);
          return res.status(500).json({ message: "Error processing image" });
        }
      }

      // Prepare the update operation. Here we also override membership_payment_status
      // based on the computed remainingDueAmount.
      const updateOperation = {
        ...updateData,
        member_total_due_amount: remainingDueAmount,
        membership_payment_status: remainingDueAmount > 0 ? "Pending" : "Paid",
        last_due_payment_date: new Date(),
      };

      // If there's a new payment amount, update total payment accordingly.
      if (parsedAmount > 0) {
        updateOperation.member_total_payment =
          userExists.member_total_payment + parsedAmount;
      }

      const updatedMember = await member.findOneAndUpdate(
        { number, gymId: req.gymId },
        { $set: updateOperation },
        { new: true },
      );

      // Update the latest renew record if payment amount was changed
      if (newPaymentAmount !== undefined) {
        const latestRenew = await Renew.findOne({
          number: updatedMember.number,
          gymId: req.gymId,
        }).sort({ createdAt: -1 });

        if (latestRenew) {
          latestRenew.membership_amount = newPaymentAmount;
          await latestRenew.save();
        }
      }

      res.status(200).json({
        message: "Member updated successfully",
        member: updatedMember,
      });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },
);

// GET /api/member/member/:number - Get a single member by phone number (alternative route) for the current gym
router.get("/member/:number", protect, attachGym, async (req, res) => {
  try {
    const { number } = req.params;
    const memberInfo = await member.findOne({ number, gymId: req.gymId });
    if (!memberInfo) {
      return res.status(404).json({ message: "User does not exist" });
    }
    res.status(200).json(memberInfo);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// POST /api/member/transfer - Add membership days from one member to another
router.post("/transfer", protect, attachGym, async (req, res) => {
  try {
    const gymid = req.gymId;
    const { source_number, target_number } = req.body;

    const source_member = await member.findOne({
      number: source_number,
      gymId: gymid,
    });
    const target_member = await member.findOne({
      number: target_number,
      gymId: gymid,
    });

    if (!source_member || !target_member) {
      return res.status(404).json({ message: "One or both members not found" });
    }

    if (
      source_member.membership_status.toLowerCase() === "inactive" ||
      source_member.membership_status.toLowerCase() === "expired"
    ) {
      return res
        .status(400)
        .json({ message: `${source_member.name} has no active membership` });
    }

    if (target_member.membership_status.toLowerCase() !== "active") {
      return res
        .status(400)
        .json({ message: `${target_member.name} has no active membership` });
    }

    // Ensure membership_end_date is a Date object
    const sourceExpiryDate = new Date(source_member.membership_end_date);
    const currentDate = Date.now();

    const daysToTransfer =
      (sourceExpiryDate.getTime() - currentDate) / (1000 * 60 * 60 * 24);

    if (daysToTransfer <= 0) {
      return res
        .status(400)
        .json({ message: `${source_member.name} has no days to transfer` });
    }

    // Deduct days from the source member
    source_member.membership_end_date = new Date(
      sourceExpiryDate.getTime() - daysToTransfer * 24 * 60 * 60 * 1000,
    );

    // Optionally update the source member's status if their membership has expired
    if (source_member.membership_end_date < new Date()) {
      source_member.membership_status = "inactive";
    }

    // Add days to the target member
    target_member.membership_end_date = new Date(
      new Date(target_member.membership_end_date).getTime() +
        daysToTransfer * 24 * 60 * 60 * 1000,
    );

    await source_member.save();
    await target_member.save();

    res
      .status(200)
      .json({ message: "Membership days transferred successfully" });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// POST /api/member/complimentary-days - Add complimentary days to a member
router.post("/complimentary-days", protect, attachGym, async (req, res) => {
  try {
    const { number, days } = req.body;
    const gymId = req.gymId;

    const memberRecord = await member.findOne({ number, gymId });
    if (!memberRecord) {
      return res.status(404).json({ message: "Member not found" });
    }

    if (isNaN(days) || days <= 0) {
      return res.status(400).json({ message: "Invalid number of days" });
    }

    const currentExpiryDate = memberRecord.membership_end_date
      ? new Date(memberRecord.membership_end_date)
      : new Date();
    const newExpiryDate = moment(currentExpiryDate).add(days, "days").toDate();

    memberRecord.membership_end_date = newExpiryDate;
    memberRecord.membership_status = "Active"; // Ensure member is active
    await memberRecord.save();

    res.status(200).json({
      message: `${days} complimentary days added successfully`,
      newExpiryDate,
    });
  } catch (error) {
    logger.error("Error adding complimentary days:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET /api/member/membership-form/:number - Get membership form data (Placeholder)
router.get("/membership-form/:number", protect, attachGym, async (req, res) => {
  try {
    const { number } = req.params;
    const gymId = req.gymId;

    const memberRecord = await member.findOne({ number, gymId });
    if (!memberRecord) {
      return res.status(404).json({ message: "Member not found" });
    }

    // In a real implementation, you would generate or retrieve a membership form here.
    // For now, we'll just send back the member data.
    res
      .status(200)
      .json({ message: "Membership form data", member: memberRecord });
  } catch (error) {
    logger.error("Error fetching membership form:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;
