import protect from "../middleware/protect.js";
import attachGym from "../middleware/attachGym.js";
import Settings from "../models/settings.js";
import databaseBackup from "../utils/backup.js";
import logger from "../utils/logger.js";
import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import os from "os";
import mongoose from "mongoose";
import { AppError, handleError } from "../utils/errorHandler.js";

import { getNextBackupTime } from "../utils/scheduler.js";

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to get storage info
async function getStorageInfo(backupsDir) {
  try {
    const backupFiles = await fs.readdir(backupsDir);
    if (backupFiles.length === 0) {
      return {
        backupDirectory: backupsDir,
        totalBackups: 0,
        oldestBackup: "N/A",
        newestBackup: "N/A",
        totalSize: "0 MB",
      };
    }

    const backupStats = await Promise.all(
      backupFiles.map(async (file) => {
        const stat = await fs.stat(path.join(backupsDir, file));
        return {
          name: file,
          time: stat.mtime,
          size: stat.size,
        };
      }),
    );

    backupStats.sort((a, b) => a.time - b.time);
    const totalSize =
      Math.round(
        (backupStats.reduce((acc, curr) => acc + curr.size, 0) /
          (1024 * 1024)) *
          100,
      ) / 100;

    return {
      backupDirectory: backupsDir,
      totalBackups: backupStats.length,
      oldestBackup: backupStats[0].time.toLocaleString(),
      newestBackup: backupStats[backupStats.length - 1].time.toLocaleString(),
      totalSize: `${totalSize} MB`,
    };
  } catch (error) {
    logger.error(`Error getting storage info: ${error.message}`);
    return {
      backupDirectory: backupsDir,
      error: "Error getting storage info",
    };
  }
}

const router = Router();

// Configure multer for backup file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "backups/");
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

// Get settings
router.get("/settings", protect, attachGym, async (req, res) => {
  try {
    const settings = await Settings.findOne({ gymId: req.gymId });
    if (!settings) {
      throw new AppError("Settings not found", 404);
    }
    logger.info(`Retrieved settings for gym ${req.gymId}`);
    res.json(settings);
  } catch (error) {
    handleError(error, req, res);
  }
});

// Update settings
router.put("/settings", protect, attachGym, async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      { gymId: req.gymId },
      req.body,
      { new: true, upsert: true },
    );
    logger.info(`Updated settings for gym ${req.gymId}`, {
      updatedFields: Object.keys(req.body),
    });

    res.json(settings);
  } catch (error) {
    handleError(error, req, res);
  }
});

// Create backup
router.post("/settings/backup", protect, attachGym, async (req, res) => {
  try {
    logger.info(`Starting backup process for gym ${req.gymId}`);
    await databaseBackup.createBackup(req.gymId);
    // Also clean up old backups
    await databaseBackup.deleteOldBackups();

    logger.info(`Backup completed successfully for gym ${req.gymId}`);
    res.status(200).json({ message: "Backup completed successfully" });
  } catch (error) {
    logger.error(`Backup failed for gym ${req.gymId}: ${error.message}`);
    handleError(new AppError("Backup failed", 500), req, res);
  }
});

// List backups
router.get("/settings/backups", protect, attachGym, async (req, res) => {
  try {
    const backups = await databaseBackup.listBackups();
    logger.info(`Retrieved ${backups.length} backups for gym ${req.gymId}`);
    res.json(backups);
  } catch (error) {
    logger.error(`Failed to list backups: ${error.message}`);
    handleError(new AppError("Failed to list backups", 500), req, res);
  }
});

// Restore from backup
router.post(
  "/settings/restore/:filename",
  protect,
  attachGym,
  async (req, res) => {
    try {
      const { filename } = req.params;
      const backupPath = path.join(databaseBackup.BACKUP_DIR, filename);

      await fs.access(backupPath);
      logger.info(`Starting restore process from backup: ${filename}`);

      await databaseBackup.restoreBackup(backupPath, req.gymId);

      logger.info(`Restore completed successfully from backup: ${filename}`);
      res.json({ message: "Restore completed successfully" });
    } catch (error) {
      logger.error(`Restore failed: ${error.message}`);
      handleError(new AppError("Restore failed", 500), req, res);
    }
  },
);

router.post(
  "/settings/upload-backup",
  protect,
  attachGym,
  upload.single("backup"),
  async (req, res) => {
    try {
      if (!req.file) {
        throw new AppError("No backup file provided", 400);
      }

      logger.info(`Backup file uploaded successfully: ${req.file.filename}`, {
        size: req.file.size,
        type: req.file.mimetype,
      });

      res.json({
        message: "Backup file uploaded successfully",
        filename: req.file.filename,
      });
    } catch (error) {
      logger.error(`Upload failed: ${error.message}`);
      handleError(error, req, res);
    }
  },
);

// Clear logs
router.delete("/settings/logs", protect, attachGym, async (req, res) => {
  try {
    // Implement your log clearing logic here
    logger.info(`Clearing logs for gym ${req.gymId}`);
    res.json({ message: "Logs cleared successfully" });
  } catch (error) {
    logger.error(`Failed to clear logs: ${error.message}`);
    handleError(error, req, res);
  }
});

// Get system information
router.get("/settings/system-info", protect, attachGym, async (req, res) => {
  try {
    logger.info(`Fetching system information for gym ${req.gymId}`);

    const dbStats = await mongoose.connection.db.stats();
    const backupsDir = path.join(__dirname, "..", "backups");

    // Get last backup info
    let lastBackup = "No backups found";
    try {
      await fs.mkdir(backupsDir, { recursive: true });
      const files = await fs.readdir(backupsDir);

      if (files.length > 0) {
        const sortedFiles = await Promise.all(
          files.map(async (file) => ({
            name: file,
            time: (await fs.stat(path.join(backupsDir, file))).mtime.getTime(),
          })),
        );
        sortedFiles.sort((a, b) => b.time - a.time);

        if (sortedFiles.length > 0) {
          lastBackup = new Date(sortedFiles[0].time).toLocaleString();
        }
      }
    } catch (error) {
      logger.error(`Error getting backup info: ${error.message}`);
      lastBackup = "Error getting backup info";
    }

    const serverStatus = await mongoose.connection.db.command({
      serverStatus: 1,
    });
    const dbSizeInMB =
      Math.round((dbStats.dataSize / (1024 * 1024)) * 100) / 100;

    const systemInfo = {
      lastBackup,
      system: {
        version: serverStatus.version,
        uptime: Math.round((serverStatus.uptime / 86400) * 10) / 10 + " days",
        lastMaintenance: new Date(
          Date.now() - serverStatus.uptime * 1000,
        ).toLocaleString(),
        connections: serverStatus.connections,
      },
      database: {
        name: mongoose.connection.name,
        size: `${dbSizeInMB} MB`,
        collections: dbStats.collections,
        documents: dbStats.objects,
        indexes: dbStats.indexes,
      },
      os: {
        type: os.type(),
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        uptime: Math.round((os.uptime() / 86400) * 10) / 10 + " days",
        memory: {
          total:
            Math.round((os.totalmem() / (1024 * 1024 * 1024)) * 100) / 100 +
            " GB",
          free:
            Math.round((os.freemem() / (1024 * 1024 * 1024)) * 100) / 100 +
            " GB",
        },
        cpus: os.cpus().length,
      },
      storageInfo: await getStorageInfo(backupsDir),
    };

    logger.info(
      `System information retrieved successfully for gym ${req.gymId}`,
    );
    res.status(200).json({
      success: true,
      data: systemInfo,
    });
  } catch (error) {
    logger.error(`Error getting system info: ${error.message}`);
    handleError(error, req, res);
  }
});

// Get next backup time
router.get("/settings/next-backup", protect, attachGym, (req, res) => {
  try {
    const nextBackup = getNextBackupTime();
    logger.info(
      `Next backup time retrieved for gym ${req.gymId}: ${nextBackup}`,
    );

    res.json({
      nextBackup,
      timezone: "IST",
      message: `Next backup scheduled for ${nextBackup.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
    });
  } catch (error) {
    logger.error(`Error getting next backup time: ${error.message}`);
    handleError(error, req, res);
  }
});

// Validate gym settings
router.post("/settings/gym/validate", protect, attachGym, async (req, res) => {
  try {
    const { gymName, gymAddress, contactEmail, contactPhone } = req.body;
    const errors = {};

    // Validation logic
    if (!gymName || gymName.length < 2) {
      errors.gymName = "Gym name must be at least 2 characters long";
    }
    if (!gymAddress || gymAddress.length < 5) {
      errors.gymAddress = "Please provide a valid address";
    }
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!contactEmail || !emailRegex.test(contactEmail)) {
      errors.contactEmail = "Please provide a valid email address";
    }
    const phoneRegex = /^\d{10}$/;
    if (!contactPhone || !phoneRegex.test(contactPhone)) {
      errors.contactPhone = "Please provide a valid 10-digit phone number";
    }

    if (Object.keys(errors).length > 0) {
      throw new AppError(JSON.stringify(errors), 400);
    }

    logger.info(`Gym settings validated successfully for gym ${req.gymId}`);
    res.json({ success: true, message: "All fields are valid" });
  } catch (error) {
    logger.error(`Validation error for gym ${req.gymId}: ${error.message}`);
    handleError(error, req, res);
  }
});

// Get gym settings
router.get("/settings/gym", protect, attachGym, async (req, res) => {
  try {
    const settings = await Settings.findOne({ gymId: req.gymId });
    if (!settings) {
      throw new AppError("Gym settings not found", 404);
    }

    logger.info(`Retrieved gym settings for gym ${req.gymId}`);
    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    logger.error(`Error fetching gym settings: ${error.message}`);
    handleError(error, req, res);
  }
});

// Update gym settings
router.put("/settings/gym", protect, attachGym, async (req, res) => {
  try {
    const { gymName, gymAddress, contactEmail, contactPhone } = req.body;

    // Validation
    if (!gymName || !gymAddress || !contactEmail || !contactPhone) {
      throw new AppError("All fields are required", 400);
    }

    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(contactEmail)) {
      throw new AppError("Invalid email format", 400);
    }

    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(contactPhone.replace(/[-\s]/g, ""))) {
      throw new AppError(
        "Invalid phone number format. Please enter 10 digits.",
        400,
      );
    }

    const settings = await Settings.findOneAndUpdate(
      { gymId: req.gymId },
      { gymName, gymAddress, contactEmail, contactPhone },
      { new: true, upsert: true, runValidators: true },
    );

    logger.info(`Updated gym settings for gym ${req.gymId}`, {
      updatedFields: { gymName, gymAddress, contactEmail, contactPhone },
    });

    res.json({
      success: true,
      message: "Settings updated successfully",
      data: settings,
    });
  } catch (error) {
    logger.error(`Error updating gym settings: ${error.message}`);
    handleError(error, req, res);
  }
});

// Delete gym settings
router.delete("/settings/gym", protect, attachGym, async (req, res) => {
  try {
    const settings = await Settings.findOneAndDelete({ gymId: req.gymId });
    if (!settings) {
      throw new AppError("Settings not found", 404);
    }

    logger.info(`Deleted gym settings for gym ${req.gymId}`);
    res.json({
      success: true,
      message: "Settings deleted successfully",
    });
  } catch (error) {
    logger.error(`Error deleting gym settings: ${error.message}`);
    handleError(error, req, res);
  }
});

export default router;
