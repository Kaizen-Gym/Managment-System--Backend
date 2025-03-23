import express from 'express';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger.js';
import { AppError, handleError } from '../utils/errorHandler.js';

// Create Router instance
const router = express.Router();

// Create logs directory if it doesn't exist
const logsDir = path.join(path.resolve(), 'frontend-logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Function to write frontend logs to separate files
const writeFrontendLog = async (level, message, context, ip) => {
  try {
    // Determine file path based on level and date
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(logsDir, `${level}-${today}.log`);
    
    // Format the log entry
    const timestamp = new Date().toISOString();
    
    // Format user info
    let userInfoStr = '';
    if (context?.userInfo && Object.keys(context.userInfo).length > 0) {
      userInfoStr = `\n  User: ${context.userInfo.email || 'anonymous'} (ID: ${context.userInfo.id || 'none'}, Role: ${context.userInfo.role || 'none'})`;
    }
    
    // Format URL
    const urlStr = context?.url ? `\n  URL: ${context.url}` : '';
    
    // Format IP address
    const ipStr = ip ? `\n  IP: ${ip}` : '';
    
    // Format context data
    let contextStr = '';
    if (context) {
      const { userInfo, url, ...otherContext } = context;
      
      if (Object.keys(otherContext).length > 0) {
        contextStr = '\n  Context: ' + 
          Object.entries(otherContext)
            .map(([key, value]) => {
              const valueStr = typeof value === 'object' 
                ? JSON.stringify(value) 
                : value;
              return `\n    ${key}: ${valueStr}`;
            })
            .join('');
      }
    }
    
    // Format error details
    let errorDetails = '';
    if (context?.error) {
      errorDetails = `\n  Stack: ${context.error}`;
    }
    
    // Build the full log entry
    const logEntry = `[${timestamp}] ${level.toUpperCase()}: ${message}${ipStr}${userInfoStr}${urlStr}${contextStr}${errorDetails}\n`;
    
    // Append to file (create if doesn't exist)
    await fs.promises.appendFile(logFile, logEntry);
    
    // Also append to combined log
    if (level !== 'combined') {
      const combinedLogFile = path.join(logsDir, `combined-${today}.log`);
      await fs.promises.appendFile(combinedLogFile, logEntry);
    }
  } catch (error) {
    // Log to server logger if there's an error with file operations
    logger.error(`Error writing frontend log: ${error.message}`);
  }
};

// API endpoint to receive logs from frontend
router.post('/', async (req, res) => {
  try {
    const { level, message, context } = req.body;
    
    // Validate required fields
    if (!level || !message) {
      throw new AppError('Missing required log data', 400);
    }
    
    // Add IP address to context
    const enhancedContext = {
      ...context,
      requestHeaders: {
        userAgent: req.headers['user-agent'],
        referer: req.headers['referer']
      }
    };
    
    // Write to appropriate file, but don't log to backend console
    await writeFrontendLog(level, message, enhancedContext, req.ip);
    
    res.status(200).json({ success: true });
  } catch (error) {
    // Use the error handler from errorHandler.js
    handleError(error, req, res);
  }
});

// API endpoint to get most recent logs (protected with admin permission)
router.get('/', (req, res) => {
  try {
    // Check for admin permissions
    if (!req.user || req.user.role !== 'Admin') {
      throw new AppError('Unauthorized access to logs', 403);
    }
    
    const logType = req.query.type || 'combined';
    const lines = parseInt(req.query.lines) || 100;
    
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(logsDir, `${logType}-${today}.log`);
    
    if (!fs.existsSync(logFile)) {
      throw new AppError('No logs found for today', 404);
    }
    
    // Read last N lines
    const fileContent = fs.readFileSync(logFile, 'utf8');
    const logLines = fileContent.split('\n').filter(line => line.trim()).slice(-lines);
    
    res.status(200).json({ success: true, logs: logLines });
  } catch (error) {
    handleError(error, req, res);
  }
});

// API endpoint to clear logs (protected with admin permission)
router.delete('/', (req, res) => {
  try {
    // Check for admin permissions
    if (!req.user || req.user.role !== 'Admin') {
      throw new AppError('Unauthorized access to delete logs', 403);
    }
    
    fs.readdir(logsDir, (err, files) => {
      if (err) throw new AppError(`Failed to read logs directory: ${err.message}`, 500);
      
      let deletedCount = 0;
      for (const file of files) {
        if (file.endsWith('.log')) {
          fs.unlinkSync(path.join(logsDir, file));
          deletedCount++;
        }
      }
      
      // Log this admin action using the server logger
      logger.info(`All logs cleared by admin ${req.user.email} (ID: ${req.user.id}). ${deletedCount} files removed.`);
      
      res.status(200).json({ 
        success: true, 
        message: 'Logs cleared successfully', 
        count: deletedCount 
      });
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

export default router;