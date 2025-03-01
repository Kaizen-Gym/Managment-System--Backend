import express from "express";
import protect from "../middleware/protect.js";
import member from "../models/member.js";
import Renew from "../models/renew.js";
import logger from "../utils/logger.js";
import attachGym from "../middleware/attachGym.js";
import mongoose from "mongoose";

const router = express.Router();

router.get("/membership/members", protect, attachGym, async (req, res) => {
  try {
    const filter = {};

    // String search (using regex for name for case-insensitive partial matching)
    if (req.query.name) filter.name = { $regex: req.query.name, $options: "i" };
    if (req.query.gender) filter.gender = req.query.gender;
    if (req.query.email) filter.email = req.query.email;
    if (req.query.number) filter.number = req.query.number;
    if (req.query.membership_type)
      filter.membership_type = req.query.membership_type;
    if (req.query.membership_status)
      filter.membership_status = req.query.membership_status;
    if (req.query.membership_payment_status)
      filter.membership_payment_status = req.query.membership_payment_status;
    if (req.query.membership_payment_mode)
      filter.membership_payment_mode = req.query.membership_payment_mode;
    if (req.query.membership_payment_reference)
      filter.membership_payment_reference = req.query.membership_payment_reference;

    // Numeric fields
    if (req.query.age) filter.age = Number(req.query.age);
    if (req.query.member_total_payment)
      filter.member_total_payment = Number(req.query.member_total_payment);
    if (req.query.membership_duration)
      filter.membership_duration = Number(req.query.membership_duration);
    if (req.query.membership_amount)
      filter.membership_amount = Number(req.query.membership_amount);

    // Date range filters for membership_start_date
    if (req.query.membership_start_date_from || req.query.membership_start_date_to) {
      filter.membership_start_date = {};
      if (req.query.membership_start_date_from)
        filter.membership_start_date.$gte = new Date(req.query.membership_start_date_from);
      if (req.query.membership_start_date_to)
        filter.membership_start_date.$lte = new Date(req.query.membership_start_date_to);
    }

    // Date range filters for membership_end_date
    if (req.query.membership_end_date_from || req.query.membership_end_date_to) {
      filter.membership_end_date = {};
      if (req.query.membership_end_date_from)
        filter.membership_end_date.$gte = new Date(req.query.membership_end_date_from);
      if (req.query.membership_end_date_to)
        filter.membership_end_date.$lte = new Date(req.query.membership_end_date_to);
    }

    // Date range filters for membership_payment_date
    if (req.query.membership_payment_date_from || req.query.membership_payment_date_to) {
      filter.membership_payment_date = {};
      if (req.query.membership_payment_date_from)
        filter.membership_payment_date.$gte = new Date(req.query.membership_payment_date_from);
      if (req.query.membership_payment_date_to)
        filter.membership_payment_date.$lte = new Date(req.query.membership_payment_date_to);
    }

    // Merge gymId filter with the rest of the filters
    const members = await member.find({ ...filter, gymId: req.gymId });
    res.json(members);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

router.get("/membership", protect, attachGym, async (req, res) => {
  try {
    // Define date ranges once for reuse
    const today = new Date();
    const thirtyDaysAgo = new Date(new Date().setDate(today.getDate() - 30));
    const thirtyDaysFromNow = new Date(new Date().setDate(today.getDate() + 30));
    
    const gymId = new mongoose.Types.ObjectId(req.gymId);

    // Run independent queries concurrently
    const [
      totalActiveMembers,
      newMemberSignups,
      expiringMemberships,
      totalRenewals,
      dailyRenewals,
      monthlyRenewals,
      renewalRevenueAgg,
      paymentMethodsBreakdown,
    ] = await Promise.all([
      // 1. Total Active Members
      member.countDocuments({ membership_status: "Active", gymId }),
      
      // 2. New Member Signups: Daily signups for the past 30 days, filtering by gymId
      member.aggregate([
        { $match: { gymId, membership_start_date: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$membership_start_date" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      
      // 3. Membership Expiry Report: Memberships expiring in the next 30 days, filtering by gymId
      member.find({
        membership_end_date: { $gte: today, $lte: thirtyDaysFromNow },
        gymId,
      }),
      
      // 4. Total Renewals (filtered by gymId)
      Renew.countDocuments({ gymId }),
      
      // 5. Daily Renewals: Number of renewals per day, filtering by gymId
      Renew.aggregate([
        { $match: { gymId } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$membership_payment_date" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      
      // 6. Monthly Renewals: Aggregated renewals by month, filtering by gymId
      Renew.aggregate([
        { $match: { gymId } },
        {
          $group: {
            _id: { year: { $year: "$membership_payment_date" }, month: { $month: "$membership_payment_date" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      
      // 7. Renewal Revenue: Total revenue generated from renewals, filtering by gymId
      Renew.aggregate([
        { $match: { gymId } },
        { $group: { _id: null, totalRevenue: { $sum: "$membership_amount" } } },
      ]),
      
      // 8. Payment Methods Breakdown: Count and total revenue by payment mode, filtering by gymId
      Renew.aggregate([
        { $match: { gymId } },
        {
          $group: {
            _id: "$membership_payment_mode",
            count: { $sum: 1 },
            total: { $sum: "$membership_amount" },
          },
        },
      ]),
    ]);

    const renewalRevenue = renewalRevenueAgg[0] ? renewalRevenueAgg[0].totalRevenue : 0;
    const paymentSummary = {
      totalPayments: totalRenewals,
      totalRevenue: renewalRevenue,
    };
    const membershipRenewalRate = totalActiveMembers > 0 ? (totalRenewals / totalActiveMembers) * 100 : 0;

    res.json({
      totalActiveMembers,
      newMemberSignups,
      expiringMemberships,
      membershipRenewalRate,
      dailyRenewals,
      monthlyRenewals,
      renewalRevenue,
      paymentSummary,
      paymentMethodsBreakdown,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get("/financial", protect, attachGym, async (req, res) => {
  try {
    const gymId = new mongoose.Types.ObjectId(req.gymId);

    // Run independent queries concurrently using Promise.all
    const [
      totalRevenueAgg,
      totalPayments,
      totalRefunds,
      totalPendingPayments,
      totalFailedPayments,
      dailyPayments,
      monthlyPayments,
      paymentMethodsBreakdown,
    ] = await Promise.all([
      // 1. Total Revenue: Sum of all membership payments, filtering by gymId
      Renew.aggregate([
        { $match: { gymId } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$membership_amount" },
          },
        },
      ]),

      // 2. Total Payments: Count of all successful (Paid) payments
      Renew.countDocuments({ membership_payment_status: "Paid", gymId }),
      // 3. Total Refunds: Count of all refunded payments
      Renew.countDocuments({ membership_payment_status: "Refunded", gymId }),
      // 4. Total Pending Payments: Count of all pending payments
      Renew.countDocuments({ membership_payment_status: "Pending", gymId }),
      // 5. Total Failed Payments: Count of all failed payments
      Renew.countDocuments({ membership_payment_status: "Failed", gymId }),
      // 6. Daily Payments: Number of payments per day, filtering by gymId
      Renew.aggregate([
        { $match: { gymId } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$membership_payment_date" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // 7. Monthly Payments: Aggregated payments by month, filtering by gymId
      Renew.aggregate([
        { $match: { gymId } },
        {
          $group: {
            _id: { year: { $year: "$membership_payment_date" }, month: { $month: "$membership_payment_date" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      // 8. Payment Methods Breakdown: Count and total revenue by payment mode, filtering by gymId
      Renew.aggregate([
        { $match: { gymId } },
        {
          $group: {
            _id: "$membership_payment_mode",
            count: { $sum: 1 },
            total: { $sum: "$membership_amount" },
          },
        },
      ]),
    ]);

    const totalRevenue = totalRevenueAgg[0] ? totalRevenueAgg[0].totalRevenue : 0;
    const paymentSummary = {
      totalPayments,
      totalRevenue,
      totalRefunds,
      totalPendingPayments,
      totalFailedPayments,
    };

    res.json({
      totalRevenue,
      paymentSummary,
      dailyPayments,
      monthlyPayments,
      paymentMethodsBreakdown,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;
