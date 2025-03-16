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


import { getNextBackupTime } from '../utils/scheduler.js';

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      return res.status(404).json({ message: "Settings not found" });
    }
    res.json(settings);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
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
    res.json(settings);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Create backup
router.post("/settings/backup", protect, attachGym, async (req, res) => {
  try {
    await databaseBackup.createBackup(req.gymId);
    // Also clean up old backups
    await databaseBackup.deleteOldBackups();
    res.status(200).json({ message: "Backup completed successfully" });
  } catch (error) {
    logger.error("Backup error:", error);
    res.status(500).json({ message: "Backup failed" });
  }
});

// List backups
router.get("/settings/backups", protect, attachGym, async (req, res) => {
  try {
    const backups = await databaseBackup.listBackups();
    res.json(backups);
  } catch (error) {
    logger.error("Error listing backups:", error);
    res
      .status(500)
      .json({ message: "Failed to list backups", error: error.message });
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

      // Verify file exists
      await fs.access(backupPath);

      // Perform restore
      await databaseBackup.restoreBackup(backupPath, req.gymId);

      res.json({ message: "Restore completed successfully" });
    } catch (error) {
      logger.error("Restore error:", error);
      res.status(500).json({ message: "Restore failed", error: error.message });
    }
  },
);

// Upload backup file
router.post(
  "/settings/upload-backup",
  protect,
  attachGym,
  upload.single("backup"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No backup file provided" });
      }
      res.json({
        message: "Backup file uploaded successfully",
        filename: req.file.filename,
      });
    } catch (error) {
      logger.error("Upload error:", error);
      res.status(500).json({ message: "Upload failed", error: error.message });
    }
  },
);

// Clear logs
router.delete("/settings/logs", protect, attachGym, async (req, res) => {
  try {
    // Implement your log clearing logic here
    res.json({ message: "Logs cleared successfully" });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get("/settings/system-info", protect, attachGym, async (req, res) => {
  try {
    // Get database stats
    const dbStats = await mongoose.connection.db.stats();

    // Get last backup info
    const backupsDir = path.join(__dirname, "..", "backups");
    let lastBackup = "No backups found";
    try {
      // Ensure backup directory exists
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
      logger.error("Error getting backup info:", error);
      lastBackup = "Error getting backup info";
    }

    // Get MongoDB version and other info
    const serverStatus = await mongoose.connection.db.command({
      serverStatus: 1,
    });

    // Calculate database size in MB
    const dbSizeInMB =
      Math.round((dbStats.dataSize / (1024 * 1024)) * 100) / 100;

    // Get system information
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
      storageInfo: {
        backupDirectory: backupsDir,
        totalBackups: 0,
        oldestBackup: "N/A",
        newestBackup: "N/A",
      },
    };

    // Get backup storage information
    try {
      const backupFiles = await fs.readdir(backupsDir);
      if (backupFiles.length > 0) {
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
        systemInfo.storageInfo = {
          ...systemInfo.storageInfo,
          totalBackups: backupStats.length,
          oldestBackup: backupStats[0].time.toLocaleString(),
          newestBackup:
            backupStats[backupStats.length - 1].time.toLocaleString(),
          totalSize:
            Math.round(
              (backupStats.reduce((acc, curr) => acc + curr.size, 0) /
                (1024 * 1024)) *
                100,
            ) /
              100 +
            " MB",
        };
      }
    } catch (error) {
      logger.error("Error getting backup storage info:", error);
    }

    // Skip mongotop command as it might not be available
    systemInfo.performance = "Performance metrics unavailable";

    res.status(200).json({
      success: true,
      data: systemInfo,
    });
  } catch (error) {
    logger.error("Error getting system info:", error);
    res.status(500).json({
      success: false,
      message: "Error getting system information",
      error: error.message,
    });
  }
});

router.get('/settings/next-backup', protect, attachGym, (req, res) => {
  const nextBackup = getNextBackupTime();
  res.json({
    nextBackup,
    timezone: 'IST',
    message: `Next backup scheduled for ${nextBackup.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`
  });
});

router.post('/settings/gym/validate', protect, attachGym, async (req, res) => {
  try {
    const { gymName, gymAddress, contactEmail, contactPhone } = req.body;
    const errors = {};

    // Validate gym name
    if (!gymName || gymName.length < 2) {
      errors.gymName = 'Gym name must be at least 2 characters long';
    }

    // Validate address
    if (!gymAddress || gymAddress.length < 5) {
      errors.gymAddress = 'Please provide a valid address';
    }

    // Validate email
    /* eslint-disable */
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!contactEmail || !emailRegex.test(contactEmail)) {
      errors.contactEmail = 'Please provide a valid email address';
    }

    // Validate phone
    const phoneRegex = /^\d{10}$/;
    if (!contactPhone || !phoneRegex.test(contactPhone)) {
      errors.contactPhone = 'Please provide a valid 10-digit phone number';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    res.json({ success: true, message: 'All fields are valid' });
  } catch (error) {
    logger.error('Error validating gym settings:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error validating settings', 
      error: error.message 
    });
  }
});

// Get gym settings
router.get("/settings/gym", protect, attachGym, async (req, res) => {
  try {
    // Find settings for the current gym or create default settings
    let settings = await Settings.findOne({ gymId: req.gymId });

    if (!settings) {
      res.status(404).json({
        success: false,
        message: 'Gym not found',
      })
    }

    res.status(200).json({
      success: true,
      data: settings,
    });
    logger.info(settings)
  } catch (error) {
    logger.error("Error fetching gym settings:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching gym settings",
      error: error.message,
    });
  }
});

// Update gym settings
router.put("/settings/gym", protect, attachGym, async (req, res) => {
  try {
    const { gymName, gymAddress, contactEmail, contactPhone } = req.body;

    // Validation
    if (!gymName || !gymAddress || !contactEmail || !contactPhone) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Email validation
    /* eslint-disable */
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(contactEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // Phone validation (basic example - adjust according to your needs)
    const phoneRegex = /^\d{10}$/; // Assumes 10-digit phone number
    if (!phoneRegex.test(contactPhone.replace(/[-\s]/g, ""))) {
      // Remove hyphens and spaces before validation
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format. Please enter 10 digits.",
      });
    }

    // Update or create settings
    const settings = await Settings.findOneAndUpdate(
      { gymId: req.gymId },
      {
        gymName,
        gymAddress,
        contactEmail,
        contactPhone,
      },
      {
        new: true, // Return updated document
        upsert: true, // Create if doesn't exist
        runValidators: true, // Run model validations
      }
    );

    logger.info(`Gym settings updated for gym: ${req.gymId}`);
    res.json({
      success: true,
      message: "Settings updated successfully",
      data: settings,
    });
  } catch (error) {
    logger.error("Error updating gym settings:", error);
    res.status(500).json({
      success: false,
      message: "Error updating gym settings",
      error: error.message,
    });
  }
});

// Delete gym settings
router.delete("/settings/gym", protect, attachGym, async (req, res) => {
  try {
    await Settings.findOneAndDelete({ gymId: req.gymId });

    logger.info(`Gym settings deleted for gym: ${req.gymId}`);
    res.json({
      success: true,
      message: "Settings deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting gym settings:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting gym settings",
      error: error.message,
    });
  }
});

export default router;
