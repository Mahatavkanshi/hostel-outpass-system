const OutpassRequest = require('../models/outpass.model');
const LocationLog = require('../models/location.model');
const mongoose = require('mongoose');

exports.submitLocation = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const outpassId = req.params.id;
    const { latitude, longitude } = req.body;

    // 🧩 1. Find the outpass
    const outpass = await OutpassRequest.findById(outpassId);

    if (!outpass) {
      return res.status(404).json({ message: 'Outpass not found' });
    }

    // 🔒 2. Confirm student owns this outpass
    if (!outpass.userId.equals(studentId)) {
      return res.status(403).json({ message: 'Unauthorized access to this outpass' });
    }

    // ⏱️ 3. Check if student is late
    const currentTime = new Date();
    const [hours, minutes] = outpass.timeIn.split(':');
    const allowedReturnTime = new Date(outpass.dateOfLeaving);
    allowedReturnTime.setHours(parseInt(hours), parseInt(minutes), 0);

    const isLate = currentTime > allowedReturnTime;

    // 🚫 4. Avoid duplicate logging
    const existingLog = await LocationLog.findOne({ outpassId, studentId });
    if (existingLog) {
      return res.status(400).json({ message: "Location already logged for this outpass." });
    }

    // ✅ 5. Save location to LocationLog
    const location = new LocationLog({
      studentId,
      outpassId,
      latitude,
      longitude,
      status: isLate ? 'late' : 'on-time'
    });
    await location.save();

    // 📍 6. Also attach location in outpass doc if student is late
    if (isLate) {
      outpass.lateLocation = {
        latitude,
        longitude,
        capturedAt: new Date()
      };
      await outpass.save();
    }

    // ✅ 7. Respond to frontend
    return res.status(200).json({
      message: isLate
        ? '⚠️ You are late. Your location has been sent to the warden.'
        : '✅ Location recorded successfully.',
      isLate
    });

  } catch (error) {
    console.error('Error submitting location:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

