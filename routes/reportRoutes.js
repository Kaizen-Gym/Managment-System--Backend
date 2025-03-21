import express from "express";
import protect from "../middleware/protect.js";
import member from "../models/member.js";
import Renew from "../models/renew.js";
import logger from "../utils/logger.js";
import attachGym from "../middleware/attachGym.js";
import mongoose from "mongoose";
import {
  calculateRetentionRate,
  calculateChurnRate,
  analyzePeakHours,
  calculateRevenueProjections,
  calculateMembershipGrowth,
  getMemberDemographics,
  getMembershipTrends,
  analyzeWeeklyPatterns,
  analyzeMonthlyTrends,
  generateAttendanceHeatmap,
  analyzePayments,
  analyzeDuePayments,
  calculateProfitabilityMetrics,
} from "../utils/analytics.js";
import { validateDateParams } from '../utils/dateValidation.js';
import Member from "../models/member.js";

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
      filter.membership_payment_reference =
        req.query.membership_payment_reference;

    // Numeric fields
    if (req.query.age) filter.age = Number(req.query.age);
    if (req.query.member_total_payment)
      filter.member_total_payment = Number(req.query.member_total_payment);
    if (req.query.membership_duration)
      filter.membership_duration = Number(req.query.membership_duration);
    if (req.query.membership_amount)
      filter.membership_amount = Number(req.query.membership_amount);

    // Date range filters for membership_start_date
    if (
      req.query.membership_start_date_from ||
      req.query.membership_start_date_to
    ) {
      filter.membership_start_date = {};
      if (req.query.membership_start_date_from)
        filter.membership_start_date.$gte = new Date(
          req.query.membership_start_date_from,
        );
      if (req.query.membership_start_date_to)
        filter.membership_start_date.$lte = new Date(
          req.query.membership_start_date_to,
        );
    }

    // Date range filters for membership_end_date
    if (
      req.query.membership_end_date_from ||
      req.query.membership_end_date_to
    ) {
      filter.membership_end_date = {};
      if (req.query.membership_end_date_from)
        filter.membership_end_date.$gte = new Date(
          req.query.membership_end_date_from,
        );
      if (req.query.membership_end_date_to)
        filter.membership_end_date.$lte = new Date(
          req.query.membership_end_date_to,
        );
    }

    // Date range filters for membership_payment_date
    if (
      req.query.membership_payment_date_from ||
      req.query.membership_payment_date_to
    ) {
      filter.membership_payment_date = {};
      if (req.query.membership_payment_date_from)
        filter.membership_payment_date.$gte = new Date(
          req.query.membership_payment_date_from,
        );
      if (req.query.membership_payment_date_to)
        filter.membership_payment_date.$lte = new Date(
          req.query.membership_payment_date_to,
        );
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
    const thirtyDaysFromNow = new Date(
      new Date().setDate(today.getDate() + 30),
    );

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
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$membership_start_date",
              },
            },
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
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$membership_payment_date",
              },
            },
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
            _id: {
              year: { $year: "$membership_payment_date" },
              month: { $month: "$membership_payment_date" },
            },
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

    const renewalRevenue = renewalRevenueAgg[0]
      ? renewalRevenueAgg[0].totalRevenue
      : 0;
    const paymentSummary = {
      totalPayments: totalRenewals,
      totalRevenue: renewalRevenue,
    };
    const membershipRenewalRate =
      totalActiveMembers > 0 ? (totalRenewals / totalActiveMembers) * 100 : 0;

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

    const [
      totalRevenueAgg,
      totalDueAgg, // Add this new query
      totalPayments,
      totalRefunds,
      totalPendingPayments,
      totalFailedPayments,
      dailyPayments,
      monthlyPayments,
      paymentMethodsBreakdown,
    ] = await Promise.all([
      // Existing queries...
      Renew.aggregate([
        { $match: { gymId } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$membership_amount" },
          },
        },
      ]),

      // New query to calculate total due
      member.aggregate([
        {
          $match: {
            gymId,
            member_total_due_amount: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            totalDue: { $sum: "$member_total_due_amount" },
            membersWithDue: { $sum: 1 },
          },
        },
      ]),

      // Rest of your existing queries...
      Renew.countDocuments({ membership_payment_status: "Paid", gymId }),
      Renew.countDocuments({ membership_payment_status: "Refunded", gymId }),
      Renew.countDocuments({ membership_payment_status: "Pending", gymId }),
      Renew.countDocuments({ membership_payment_status: "Failed", gymId }),
      Renew.aggregate([
        { $match: { gymId } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$membership_payment_date",
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Renew.aggregate([
        { $match: { gymId } },
        {
          $group: {
            _id: {
              year: { $year: "$membership_payment_date" },
              month: { $month: "$membership_payment_date" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
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

    const totalRevenue = totalRevenueAgg[0]
      ? totalRevenueAgg[0].totalRevenue
      : 0;
    const totalDue = totalDueAgg[0] ? totalDueAgg[0].totalDue : 0;

    const paymentSummary = {
      totalPayments,
      totalRevenue,
      totalDue, // Add total due to payment summary
      totalRefunds,
      totalPendingPayments,
      totalFailedPayments,
    };

    res.json({
      totalRevenue,
      totalDue, // Include total due in response
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

router.get("/analytics/membership", protect, attachGym, validateDateParams, async (req, res) => {
  try {
    const { date, interval, } = req.query;
    const endDate = date ? new Date(date) : new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - parseInt(interval || 30));

    // Pass these dates to your analytics functions
    const retentionData = await calculateRetentionRate(req.gymId, startDate, endDate);
    const churnData = await calculateChurnRate(req.gymId, startDate, endDate);
    const growthData = await calculateMembershipGrowth(
      req.gymId,
      startDate,
      endDate,
    );
    const demographics = await getMemberDemographics(
      req.gymId,
      startDate,
      endDate,
    );
    const trends = await getMembershipTrends(req.gymId, startDate, endDate);

    res.json({
      retention: retentionData,
      churn: churnData,
      growth: growthData,
      demographics,
      trends,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/analytics/attendance", protect, attachGym, validateDateParams, async (req, res) => {
    try {
      const { date, interval } = req.query;
      const endDate = date ? new Date(date) : new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - parseInt(interval || 30));

      // Peak Hours Analysis with date range
      const peakHours = await analyzePeakHours(req.gymId, startDate, endDate);

      // Weekly Patterns with date range
      const weeklyPatterns = await analyzeWeeklyPatterns(
        req.gymId,
        startDate,
        endDate,
      );

      // Monthly Trends with date range
      const monthlyTrends = await analyzeMonthlyTrends(
        req.gymId,
        startDate,
        endDate,
      );

      // Attendance Heatmap Data with date range
      const heatmapData = await generateAttendanceHeatmap(
        req.gymId,
        startDate,
        endDate,
      );

      res.json({
        peakHours,
        weeklyPatterns,
        monthlyTrends,
        heatmapData,
        dateRange: {
          startDate,
          endDate,
        },
      });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

router.get("/analytics/financial", protect, attachGym, validateDateParams, async (req, res) => {
    try {
      const { date, interval } = req.query;
      const endDate = date ? new Date(date) : new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - parseInt(interval || 30));

      // Revenue Projections with date range
      const projections = await calculateRevenueProjections(
        req.gymId,
        startDate,
        endDate,
      );

      // Payment Analysis with date range
      const paymentAnalysis = await analyzePayments(
        req.gymId,
        startDate,
        endDate,
      );

      // Due Payments Trend with date range
      const duePaymentsTrend = await analyzeDuePayments(
        req.gymId,
        startDate,
        endDate,
      );

      // Profitability Metrics with date range
      const profitabilityMetrics = await calculateProfitabilityMetrics(
        req.gymId,
        startDate,
        endDate,
      );

      res.json({
        projections,
        paymentAnalysis,
        duePaymentsTrend,
        profitabilityMetrics,
        dateRange: {
          startDate,
          endDate,
        },
      });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

router.get('/upcoming-renewals', protect, attachGym, async (req, res) => {
  try {
    // Create dates in UTC
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(today.getDate() + 7);
    sevenDaysFromNow.setUTCHours(23, 59, 59, 999);

    const upcomingRenewals = await Member.find({
      membership_end_date: {
        $gte: today,
        $lte: sevenDaysFromNow
      },
      membership_status: 'Active',
      gymId: req.gymId
    }).select('name number membership_type membership_end_date membership_amount');

    const totalExpectedRevenue = upcomingRenewals.reduce(
      (total, member) => total + (member.membership_amount || 0),
      0
    );

    res.json({
      renewals: upcomingRenewals,
      totalCount: upcomingRenewals.length,
      totalExpectedRevenue,
      queryDetails: {
        dateRange: {
          from: today,
          to: sevenDaysFromNow
        },
        gymId: req.gymId
      }
    });
  } catch (error) {
    logger.error('Error fetching upcoming renewals:', error);
    res.status(500).json({ 
      message: 'Error fetching upcoming renewals',
      error: error.message
    });
  }
});

router.get('/due-details', protect, attachGym, async (req, res) => {
  try {
    // Find all members with due amounts greater than 0
    const members = await member.find({ 
      gymId: req.gymId,
      member_total_due_amount: { $gt: 0 } 
    })
    .select('name number member_total_due_amount last_due_payment_date last_payment_date membership_type')
    .sort({ member_total_due_amount: -1 }); // Sort by highest due amount first

    // Calculate statistics
    const totalDue = members.reduce((sum, member) => sum + member.member_total_due_amount, 0);
    const averageDueAmount = members.length > 0 ? totalDue / members.length : 0;
    const highestDueAmount = members.length > 0 ? members[0].member_total_due_amount : 0;
    const lowestDueAmount = members.length > 0 ? members[members.length - 1].member_total_due_amount : 0;

    // Get payment history for members with dues
    const paymentHistory = await Renew.find({
      gymId: req.gymId,
      number: { $in: members.map(m => m.number) },
      is_due_payment: true
    })
    .sort({ membership_payment_date: -1 })
    .limit(50); // Limit to last 50 due payments

    // Group payments by member
    const memberPayments = {};
    paymentHistory.forEach(payment => {
      if (!memberPayments[payment.number]) {
        memberPayments[payment.number] = [];
      }
      memberPayments[payment.number].push({
        amount: payment.membership_amount,
        date: payment.membership_payment_date,
        mode: payment.membership_payment_mode
      });
    });

    // Enhance member data with payment history
    const enhancedMembers = members.map(m => ({
      _id: m._id,
      name: m.name,
      number: m.number,
      member_total_due_amount: m.member_total_due_amount,
      membership_type: m.membership_type,
      last_payment_date: m.last_payment_date,
      last_due_payment_date: m.last_due_payment_date,
      payment_history: memberPayments[m.number] || []
    }));

    res.json({
      members: enhancedMembers,
      totalDue,
      statistics: {
        totalMembers: members.length,
        averageDueAmount,
        highestDueAmount,
        lowestDueAmount
      },
      summary: {
        totalPaymentsProcessed: paymentHistory.length,
        recentPayments: paymentHistory.slice(0, 5) // Last 5 payments
      }
    });

  } catch (error) {
    logger.error('Error fetching due details:', error);
    res.status(500).json({ 
      message: 'Error fetching due details', 
      error: error.message 
    });
  }
});

export default router;
