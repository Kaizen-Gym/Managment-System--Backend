import { exec } from "child_process";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import logger from "./logger.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DatabaseBackup {
  constructor() {
    this.BACKUP_DIR = path.join(__dirname, "..", "backups");
    this.initializeBackupDirectory();
    this.collections = [
      "members",
      "attendances",
      "membershipplans",
      "renews",
      "trainers",
      "users",
      "settings",
    ];
  }

  async initializeBackupDirectory() {
    try {
      await fs.access(this.BACKUP_DIR);
    } catch (error) {
      logger.error(error)
      await fs.mkdir(this.BACKUP_DIR, { recursive: true });
    }
  }

  async listBackups() {
    try {
      // Ensure backup directory exists
      await this.initializeBackupDirectory();

      const files = await fs.readdir(this.BACKUP_DIR);
      const backups = await Promise.all(
        files
          .filter((file) => file.endsWith(".gz")) // Only include .gz files
          .map(async (filename) => {
            const filePath = path.join(this.BACKUP_DIR, filename);
            const stats = await fs.stat(filePath);
            return {
              filename,
              size: stats.size,
              createdAt: stats.birthtime,
            };
          }),
      );
      return backups.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      logger.error("Error listing backups:", error);
      throw error;
    }
  }

  createBackup(gymId) {
    return new Promise((resolve, reject) => {
      try {
        const timestamp = new Date().toISOString().replace(/:/g, "-");

        logger.info(`Starting backup for gym ${gymId} at ${timestamp}`);

        const mongoUri = process.env.MongoDB || process.env.MONGODB_URI;
        if (!mongoUri) {
          throw new Error("MongoDB URI is not defined");
        }

        const command = [
          "mongodump",
          `/uri:"${mongoUri}"`,
          `/db:"Gym"`,
          `/out:"${this.BACKUP_DIR}"`,
          `/query:"{\\"gymId\\": \\"${gymId}\\"}"`,
        ].join(" ");
        
        /* eslint-disable no-unused-vars */
        exec(command, (error, stdout, stderr) => {
          if (error) {
            logger.error(`Backup error for gym ${gymId}:`, error);
            reject(new Error("Backup failed"));
            return;
          }

          logger.info(`Backup completed successfully for gym ${gymId}`);
          resolve({ success: true, message: "Backup completed successfully" });
        });
      } catch (error) {
        logger.error(`Backup creation error for gym ${gymId}:`, error);
        reject(new Error("Backup failed"));
      }
    });
  }

  async deleteOldBackups(retentionDays = 14) {
    try {
      const files = await fs.readdir(this.BACKUP_DIR);
      const now = new Date();
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.BACKUP_DIR, file);
        const stats = await fs.stat(filePath);
        const daysOld = (now - stats.mtime) / (1000 * 60 * 60 * 24);

        if (daysOld > retentionDays) {
          await fs.unlink(filePath);
          deletedCount++;
          logger.info(`Deleted old backup: ${file}`);
        }
      }

      logger.info(`Cleaned up ${deletedCount} old backups`);
    } catch (error) {
      logger.error("Error cleaning up old backups:", error);
    }
  }
}

const databaseBackup = new DatabaseBackup();
export default databaseBackup;
