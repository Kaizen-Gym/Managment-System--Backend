import Member from "../models/member.js";
import Attendance from "../models/attendance.js";
import Renew from "../models/renew.js";
import mongoose from "mongoose";

export const calculateRetentionRate = async (gymId) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Get total active members 90 days ago
    const membersNinetyDaysAgo = await Member.countDocuments({
      gymId,
      createdAt: { $lte: ninetyDaysAgo },
      membership_status: "Active",
    });

    // Get members from 90 days ago who are still active
    const stillActiveMembersCount = await Member.countDocuments({
      gymId,
      createdAt: { $lte: ninetyDaysAgo },
      membership_status: "Active",
      membership_end_date: { $gte: new Date() },
    });

    // Calculate retention rate
    const retentionRate =
      membersNinetyDaysAgo > 0
        ? (stillActiveMembersCount / membersNinetyDaysAgo) * 100
        : 0;

    // Get monthly retention data
    const monthlyRetention = await Member.aggregate([
      { $match: { gymId: new mongoose.Types.ObjectId(gymId) } },
      {
        $group: {
          _id: {
            year: { $year: "$membership_end_date" },
            month: { $month: "$membership_end_date" },
          },
          totalMembers: { $sum: 1 },
          retainedMembers: {
            $sum: {
              $cond: [{ $eq: ["$membership_status", "Active"] }, 1, 0],
            },
          },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    return {
      currentRetentionRate: retentionRate,
      monthlyRetention,
      activeMembers: stillActiveMembersCount,
      totalAnalyzed: membersNinetyDaysAgo,
    };
  } catch (error) {
    throw new Error(`Error calculating retention rate: ${error.message}`);
  }
};

export const calculateChurnRate = async (gymId) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get total members that existed 30 days ago
    const totalMembersLastMonth = await Member.countDocuments({
      gymId,
      createdAt: { $lte: thirtyDaysAgo },
    });

    // Get members who became inactive in the last 30 days
    const lostMembers = await Member.find({
      gymId,
      membership_status: { $in: ["Inactive", "Expired"] },
      membership_end_date: { $gte: thirtyDaysAgo, $lte: new Date() },
    });

    const churnRate =
      totalMembersLastMonth > 0
        ? (lostMembers.length / totalMembersLastMonth) * 100
        : 0;

    // Analyze reasons for churn (if you have that data)
    const churnReasons = await analyzeChurnReasons(lostMembers);

    // Monthly churn trends
    const monthlyChurn = await Member.aggregate([
      {
        $match: {
          gymId: new mongoose.Types.ObjectId(gymId),
          membership_status: { $in: ["Inactive", "Expired"] },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$membership_end_date" },
            month: { $month: "$membership_end_date" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    return {
      currentChurnRate: churnRate,
      lostMembersCount: lostMembers.length,
      churnReasons,
      monthlyChurn,
    };
  } catch (error) {
    throw new Error(`Error calculating churn rate: ${error.message}`);
  }
};

export const analyzePeakHours = async (gymId, startDate, endDate) => {
  try {
    // Aggregate attendance data by hour
    const hourlyAttendance = await Attendance.aggregate([
      {
        $match: {
          gymId: new mongoose.Types.ObjectId(gymId),
          checkIn: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: {
            hour: { $hour: "$checkIn" },
            dayOfWeek: { $dayOfWeek: "$checkIn" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.dayOfWeek": 1, "_id.hour": 1 } },
    ]);

    // Calculate average duration of visits
    const averageDuration = await calculateAverageDuration(
      gymId,
      startDate,
      endDate,
    );

    // Get busiest days
    const busiestDays = await Attendance.aggregate([
      {
        $match: {
          gymId: new mongoose.Types.ObjectId(gymId),
          checkIn: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: { $dayOfWeek: "$checkIn" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    return {
      hourlyPatterns: hourlyAttendance,
      averageVisitDuration: averageDuration,
      busiestDays,
      totalVisits: hourlyAttendance.reduce((sum, curr) => sum + curr.count, 0),
    };
  } catch (error) {
    throw new Error(`Error analyzing peak hours: ${error.message}`);
  }
};

export const calculateMembershipGrowth = async (gymId) => {
  try {
    const today = new Date();
    const startOfCurrentMonth = new Date(
      today.getFullYear(),
      today.getMonth(),
      1,
    );
    const endOfCurrentMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
    );

    // Get current month's new members
    const currentMonthGrowth = await Member.aggregate([
      {
        $match: {
          gymId: new mongoose.Types.ObjectId(gymId),
          createdAt: {
            $gte: startOfCurrentMonth,
            $lte: endOfCurrentMonth,
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          newMembers: { $sum: 1 },
          totalRevenue: { $sum: "$membership_amount" },
        },
      },
    ]);

    // Get historical growth data for trends
    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, 1);
    const monthlyGrowth = await Member.aggregate([
      {
        $match: {
          gymId: new mongoose.Types.ObjectId(gymId),
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          newMembers: { $sum: 1 },
          totalRevenue: { $sum: "$membership_amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Calculate total growth (all-time total members)
    const totalGrowth = await Member.countDocuments({
      gymId: new mongoose.Types.ObjectId(gymId),
    });

    return {
      currentMonthGrowth: currentMonthGrowth[0] || {
        newMembers: 0,
        totalRevenue: 0,
      },
      monthlyGrowth,
      totalGrowth,
    };
  } catch (error) {
    throw new Error(`Error calculating membership growth: ${error.message}`);
  }
};

export const getMemberDemographics = async (gymId) => {
  try {
    const [ageDistribution, genderDistribution, membershipTypeDistribution] =
      await Promise.all([
        // Age distribution
        Member.aggregate([
          { $match: { gymId: new mongoose.Types.ObjectId(gymId) } },
          {
            $group: {
              _id: {
                $switch: {
                  branches: [
                    { case: { $lte: ["$age", 20] }, then: "Under 20" },
                    { case: { $lte: ["$age", 30] }, then: "21-30" },
                    { case: { $lte: ["$age", 40] }, then: "31-40" },
                    { case: { $lte: ["$age", 50] }, then: "41-50" },
                  ],
                  default: "Over 50",
                },
              },
              count: { $sum: 1 },
            },
          },
        ]),

        // Gender distribution
        Member.aggregate([
          { $match: { gymId: new mongoose.Types.ObjectId(gymId) } },
          {
            $group: {
              _id: "$gender",
              count: { $sum: 1 },
            },
          },
        ]),

        // Membership type distribution
        Member.aggregate([
          { $match: { gymId: new mongoose.Types.ObjectId(gymId) } },
          {
            $group: {
              _id: "$membership_type",
              count: { $sum: 1 },
              revenue: { $sum: "$membership_amount" },
            },
          },
        ]),
      ]);

    return {
      ageDistribution,
      genderDistribution,
      membershipTypeDistribution,
    };
  } catch (error) {
    throw new Error(`Error getting member demographics: ${error.message}`);
  }
};

export const getMembershipTrends = async (gymId) => {
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    return await Member.aggregate([
      { $match: { gymId: new mongoose.Types.ObjectId(gymId) } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          activeMembers: {
            $sum: {
              $cond: [{ $eq: ["$membership_status", "Active"] }, 1, 0],
            },
          },
          totalRevenue: { $sum: "$membership_amount" },
          averageDuration: { $avg: "$membership_duration" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);
  } catch (error) {
    throw new Error(`Error getting membership trends: ${error.message}`);
  }
};

export const analyzeWeeklyPatterns = async (gymId) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return await Attendance.aggregate([
      {
        $match: {
          gymId: new mongoose.Types.ObjectId(gymId),
          checkIn: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            dayOfWeek: { $dayOfWeek: "$checkIn" },
            hour: { $hour: "$checkIn" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.dayOfWeek": 1, "_id.hour": 1 } },
    ]);
  } catch (error) {
    throw new Error(`Error analyzing weekly patterns: ${error.message}`);
  }
};

export const analyzeMonthlyTrends = async (gymId) => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    return await Attendance.aggregate([
      {
        $match: {
          gymId: new mongoose.Types.ObjectId(gymId),
          checkIn: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$checkIn" },
            month: { $month: "$checkIn" },
          },
          totalVisits: { $sum: 1 },
          uniqueMembers: { $addToSet: "$number" },
        },
      },
      {
        $project: {
          _id: 1,
          totalVisits: 1,
          uniqueMembers: { $size: "$uniqueMembers" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);
  } catch (error) {
    throw new Error(`Error analyzing monthly trends: ${error.message}`);
  }
};

export const generateAttendanceHeatmap = async (gymId) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return await Attendance.aggregate([
      {
        $match: {
          gymId: new mongoose.Types.ObjectId(gymId),
          checkIn: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$checkIn" } },
            hour: { $hour: "$checkIn" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1, "_id.hour": 1 } },
    ]);
  } catch (error) {
    throw new Error(`Error generating attendance heatmap: ${error.message}`);
  }
};

export const analyzePayments = async (gymId, startDate, endDate) => {
  try {
    const [paymentMethods, paymentTrends] = await Promise.all([
      // Payment methods breakdown
      Renew.aggregate([
        {
          $match: {
            gymId: new mongoose.Types.ObjectId(gymId),
            membership_payment_date: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        },
        {
          $group: {
            _id: "$membership_payment_mode",
            count: { $sum: 1 },
            total: { $sum: "$membership_amount" },
          },
        },
      ]),

      // Payment trends over time
      Renew.aggregate([
        {
          $match: {
            gymId: new mongoose.Types.ObjectId(gymId),
            membership_payment_date: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$membership_payment_date" },
              month: { $month: "$membership_payment_date" },
            },
            total: { $sum: "$membership_amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
    ]);

    return {
      paymentMethods,
      paymentTrends,
      dateRange: {
        startDate,
        endDate,
      },
    };
  } catch (error) {
    throw new Error(`Error analyzing payments: ${error.message}`);
  }
};

export const analyzeDuePayments = async (gymId, startDate, endDate) => {
  try {
    return await Member.aggregate([
      {
        $match: {
          gymId: new mongoose.Types.ObjectId(gymId),
          member_total_due_amount: { $gt: 0 },
          membership_payment_date: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$membership_payment_date" },
            month: { $month: "$membership_payment_date" },
          },
          totalDue: { $sum: "$member_total_due_amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);
  } catch (error) {
    throw new Error(`Error analyzing due payments: ${error.message}`);
  }
};

export const calculateProfitabilityMetrics = async (
  gymId,
  startDate,
  endDate,
) => {
  try {
    const [revenue, dues, expenses] = await Promise.all([
      // Total Revenue
      Renew.aggregate([
        {
          $match: {
            gymId: new mongoose.Types.ObjectId(gymId),
            membership_payment_date: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$membership_amount" },
          },
        },
      ]),

      // Total Due Amount
      Member.aggregate([
        {
          $match: {
            gymId: new mongoose.Types.ObjectId(gymId),
            membership_payment_date: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$member_total_due_amount" },
          },
        },
      ]),

      // Expenses (if you have an expenses collection)
      // For now, returning placeholder data
      Promise.resolve([{ _id: null, total: 0 }]),
    ]);

    const totalRevenue = revenue[0]?.total || 0;
    const totalDues = dues[0]?.total || 0;
    const totalExpenses = expenses[0]?.total || 0;
    const netIncome = totalRevenue - totalExpenses;
    const profitMargin =
      totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalDues,
      totalExpenses,
      netIncome,
      profitMargin,
      dateRange: {
        startDate,
        endDate,
      },
    };
  } catch (error) {
    throw new Error(
      `Error calculating profitability metrics: ${error.message}`,
    );
  }
};

// Helper functions

const analyzeChurnReasons = async (lostMembers) => {
  // Placeholder for churn reason analysis
  // In a real implementation, you might have additional data about why members left
  return {
    expired: lostMembers.filter((m) => m.membership_status === "Expired")
      .length,
    inactive: lostMembers.filter((m) => m.membership_status === "Inactive")
      .length,
  };
};

const calculateAverageDuration = async (gymId, startDate, endDate) => {
  const result = await Attendance.aggregate([
    {
      $match: {
        gymId: new mongoose.Types.ObjectId(gymId),
        checkOut: { $exists: true },
        checkIn: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $project: {
        duration: { $subtract: ["$checkOut", "$checkIn"] },
      },
    },
    {
      $group: {
        _id: null,
        averageDuration: { $avg: "$duration" },
      },
    },
  ]);

  return result[0]?.averageDuration || 0;
};

const calculateGrowthRate = (historicalData) => {
  if (historicalData.length < 2) return 0;

  // Calculate month-over-month growth rates
  const monthlyGrowthRates = [];
  for (let i = 1; i < historicalData.length; i++) {
    const previousRevenue = historicalData[i - 1].revenue;
    const currentRevenue = historicalData[i].revenue;
    if (previousRevenue > 0) {
      const monthlyRate = (currentRevenue - previousRevenue) / previousRevenue;
      monthlyGrowthRates.push(monthlyRate);
    }
  }

  // Return average monthly growth rate
  if (monthlyGrowthRates.length > 0) {
    return (
      monthlyGrowthRates.reduce((sum, rate) => sum + rate, 0) /
      monthlyGrowthRates.length
    );
  }
  return 0;
};

const generateProjections = (historicalData, growthRate, periods) => {
  const projections = [];
  const lastDataPoint = historicalData[historicalData.length - 1];
  let lastRevenue = lastDataPoint.revenue;
  let currentYear = lastDataPoint._id.year;
  let currentMonth = lastDataPoint._id.month;

  for (let i = 0; i < periods; i++) {
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }

    lastRevenue *= 1 + growthRate;
    projections.push({
      _id: { year: currentYear, month: currentMonth },
      revenue: Math.round(lastRevenue),
    });
  }

  return projections;
};

export const calculateRevenueProjections = async (
  gymId,
  startDate,
  endDate,
) => {
  try {
    // Get historical revenue data
    const historicalRevenue = await Renew.aggregate([
      {
        $match: {
          gymId: new mongoose.Types.ObjectId(gymId),
          membership_payment_date: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$membership_payment_date" },
            month: { $month: "$membership_payment_date" },
          },
          revenue: { $sum: "$membership_amount" },
          renewalCount: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Get total members and renewal information
    const [memberStats, renewalStats] = await Promise.all([
      Member.aggregate([
        {
          $match: {
            gymId: new mongoose.Types.ObjectId(gymId),
            membership_status: "Active",
          },
        },
        {
          $group: {
            _id: null,
            totalMembers: { $sum: 1 },
            avgMembershipAmount: { $avg: "$membership_amount" },
          },
        },
      ]),
      Renew.aggregate([
        {
          $match: {
            gymId: new mongoose.Types.ObjectId(gymId),
            membership_payment_date: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        },
        {
          $group: {
            _id: null,
            totalRenewals: { $sum: 1 },
            averageRenewalAmount: { $avg: "$membership_amount" },
          },
        },
      ]),
    ]);

    // Calculate metrics
    const totalMembers = memberStats[0]?.totalMembers || 0;
    const averageMembershipAmount = memberStats[0]?.avgMembershipAmount || 0;
    const totalRenewals = renewalStats[0]?.totalRenewals || 0;
    const averageRenewalAmount = renewalStats[0]?.averageRenewalAmount || 0;

    // Calculate renewal rate
    const renewalRate = totalMembers > 0 ? totalRenewals / totalMembers : 0;

    // Calculate growth rate from historical data
    const growthRate = calculateGrowthRate(historicalRevenue);

    // Generate 3-month projections
    const projections = [];
    const lastDataPoint = historicalRevenue[historicalRevenue.length - 1];
    let baseRevenue = lastDataPoint?.revenue || 0;
    let currentYear = lastDataPoint?._id.year || new Date().getFullYear();
    let currentMonth = lastDataPoint?._id.month || new Date().getMonth() + 1;

    for (let i = 0; i < 3; i++) {
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }

      // Calculate projected revenue components
      const expectedRenewals = totalMembers * renewalRate;
      const expectedRenewalRevenue = expectedRenewals * averageRenewalAmount;
      const growthRevenue = baseRevenue * growthRate;

      // Total projected revenue
      const projectedRevenue = Math.round(
        expectedRenewalRevenue + growthRevenue,
      );

      projections.push({
        _id: { year: currentYear, month: currentMonth },
        projectedRevenue,
        expectedRenewals: Math.round(expectedRenewals),
        baseRevenue: Math.round(baseRevenue),
        growthRevenue: Math.round(growthRevenue),
      });

      baseRevenue = projectedRevenue; // Use this as base for next month
    }

    // Get upcoming renewals for validation
    const today = new Date();
    const threeMonthsFromNow = new Date(today);
    threeMonthsFromNow.setMonth(today.getMonth() + 3);

    const upcomingRenewals = await Member.find({
      gymId: new mongoose.Types.ObjectId(gymId),
      membership_end_date: {
        $gte: today,
        $lte: threeMonthsFromNow,
      },
    })
      .select("membership_amount membership_end_date")
      .sort({ membership_end_date: 1 });

    return {
      historicalRevenue,
      metrics: {
        renewalRate: renewalRate * 100, // Convert to percentage
        growthRate: growthRate * 100, // Convert to percentage
        averageMembershipAmount,
        averageRenewalAmount,
      },
      projections,
      upcomingRenewals: upcomingRenewals.map((renewal) => ({
        amount: renewal.membership_amount,
        dueDate: renewal.membership_end_date,
      })),
    };
  } catch (error) {
    throw new Error(`Error calculating revenue projections: ${error.message}`);
  }
};
