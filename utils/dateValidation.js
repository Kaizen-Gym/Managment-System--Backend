export const validateDateParams = (req, res, next) => {
  try {
    const { date, interval } = req.query;

    // Set defaults if not provided
    if (!date) {
      req.query.date = new Date().toISOString();
    }

    if (!interval) {
      req.query.interval = "30";
    }

    // Validate interval is one of the allowed values
    const allowedIntervals = ["15", "30", "90", "all"];
    if (!allowedIntervals.includes(req.query.interval)) {
      return res.status(400).json({ message: "Invalid interval value" });
    }

    // Validate date format

    if (interval === "all") {
      // Skip date validation for 'all' interval
      return next();
    }

    const parsedDate = new Date(req.query.date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    // Calculate start date based on interval
    const endDate = parsedDate;
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - parseInt(req.query.interval));

    // Add calculated dates to request object
    req.dateRange = {
      startDate,
      endDate,
    };

    next();
  } catch (error) {
    return res.status(400).json({ message: "Date validation error" });
  }
};
