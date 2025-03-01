import fs from "fs";

const logger = {
  info: function (message) {
    let date = new Date();
    let log = `[${date.toISOString()}] [INFO] ${message}`;
    console.log(log);
    fs.appendFileSync("logs.log", log + "\n");
  },

  warn: function (message) {
    this.info(`[WARN] ${message}`);
  },

  error: function (...args) {
    const logMessage = `[${new Date().toISOString()}] [ERROR] ` + args.join(' ') + '\n';
    console.error(logMessage);
    fs.appendFileSync("logs.log", logMessage);
  },

  debug: function (message) {
    let date = new Date();
    let stack = new Error().stack.split("\n")[2].trim();
    let log = `[${date.toISOString()}] [DEBUG] ${message} (from ${stack})`;
    fs.appendFileSync("debug.log", log + "\n");
  },
};

export default logger;
