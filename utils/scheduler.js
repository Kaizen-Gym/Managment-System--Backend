import schedule from "node-schedule";
import databaseBackup from "./backup.js";
import logger from "./logger.js";
import Member from "../models/member.js";

const checkMembershipStatus = async () => {
  try {
    logger.info("Starting membership status check...");

    const currentDate = new Date();

    // Find all members whose membership has expired but status is still Active
    const expiredMembers = await Member.find({
      membership_status: "Active",
      membership_end_date: { $lt: currentDate },
    });

    if (expiredMembers.length > 0) {
      // Update all expired memberships to Inactive
      const updatePromises = expiredMembers.map(async (member) => {
        try {
          await Member.findByIdAndUpdate(member._id, {
            membership_status: "Expired",
          });
          logger.info(
            `Updated membership status to Expired for member: ${member.id}`,
          );
        } catch (error) {
          logger.error(
            `Failed to update membership status for member ${member.id}:`,
            error,
          );
        }
      });

      await Promise.all(updatePromises);
      logger.info(`Updated ${expiredMembers.length} expired memberships`);
    } else {
      logger.info("No expired memberships found");
    }
  } catch (error) {
    logger.error("Membership status check failed:", error);
  }
};

export const initializeScheduledTasks = async () => {
  // Run membership check immediately when server starts
  logger.info("Running initial membership status check...");
  await checkMembershipStatus();

  // Schedule backup at midnight IST (18:30 UTC previous day)
  schedule.scheduleJob("30 18 * * *", async () => {
    try {
      logger.info("Starting scheduled daily backup...");

      // Get all unique gymIds from your database
      const mongoose = (await import("mongoose")).default;
      const gyms = await mongoose.connection.db
        .collection("gyms")
        .distinct("_id");

      // Backup for each gym
      for (const gymId of gyms) {
        try {
          await databaseBackup.createBackup(gymId.toString());
          logger.info(`Daily backup completed successfully for gym: ${gymId}`);
        } catch (error) {
          logger.error(`Failed to create backup for gym ${gymId}:`, error);
        }
      }

      // Clean up old backups
      await databaseBackup.deleteOldBackups();
      logger.info("Scheduled backup process completed");
    } catch (error) {
      logger.error("Scheduled backup failed:", error);
    }
  });

  // New membership status checker (runs every 5 minutes)
  schedule.scheduleJob("*/5 * * * *", async () => {
    try {
      logger.info("Starting membership status check...");

      const currentDate = new Date();

      // Find all members whose membership has expired but status is still Active
      const expiredMembers = await Member.find({
        membership_status: "Active",
        membership_end_date: { $lt: currentDate },
      });

      if (expiredMembers.length > 0) {
        // Update all expired memberships to Inactive
        const updatePromises = expiredMembers.map(async (member) => {
          try {
            await Member.findByIdAndUpdate(member._id, {
              membership_status: "Expired",
            });
            logger.info(
              `Updated membership status to Expired for member: ${member.id}`,
            );
          } catch (error) {
            logger.error(
              `Failed to update membership status for member ${member.id}:`,
              error,
            );
          }
        });

        await Promise.all(updatePromises);
        logger.info(`Updated ${expiredMembers.length} expired memberships`);
      } else {
        logger.info("No expired memberships found");
      }
    } catch (error) {
      logger.error("Membership status check failed:", error);
    }
  });

  logger.info("Scheduled tasks initialized");
};

export const getNextBackupTime = () => {
  const rule = new schedule.RecurrenceRule();
  rule.hour = 18;
  rule.minute = 30;

  const nextInvocation = schedule.scheduleJob(rule, () => {}).nextInvocation();
  return nextInvocation;
};

export const getNextScheduledTimes = () => {
  // Backup schedule rule
  const backupRule = new schedule.RecurrenceRule();
  backupRule.hour = 18;
  backupRule.minute = 30;

  // Membership check rule (every 5 minutes)
  const membershipCheckRule = new schedule.RecurrenceRule();
  membershipCheckRule.minute = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  return {
    nextBackup: schedule.scheduleJob(backupRule, () => {}).nextInvocation(),
    nextMembershipCheck: schedule
      .scheduleJob(membershipCheckRule, () => {})
      .nextInvocation(),
  };
};
