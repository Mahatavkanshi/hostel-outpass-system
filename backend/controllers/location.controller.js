const ApprovedOutpass = require('../models/approvedOutpass.model');
const LocationLog = require('../models/location.model');
const mongoose = require('mongoose');

exports.submitLocation = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const outpassId = req.params.id;
    const { latitude, longitude } = req.body;

    console.log('📍 Location submission:', { studentId, outpassId, latitude, longitude });

    // Validate input
    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    if (!outpassId) {
      return res.status(400).json({ message: 'Outpass ID is required' });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(outpassId)) {
      return res.status(400).json({ message: 'Invalid outpass ID format' });
    }

    // 🧩 1. Find the approved outpass
    const outpass = await ApprovedOutpass.findById(outpassId);
    console.log('🔍 Found outpass:', outpass ? outpass._id : 'NOT FOUND');

    if (!outpass) {
      return res.status(404).json({ message: 'Approved outpass not found' });
    }

    // 🔒 2. Confirm student owns this outpass
    if (!outpass.userId.equals(studentId)) {
      console.log('🚫 Unauthorized access attempt:', { studentId, outpassUserId: outpass.userId });
      return res.status(403).json({ message: 'Unauthorized access to this outpass' });
    }

    // ⏱️ 3. Check if student is late
    const currentTime = new Date();
    const [hours, minutes] = outpass.timeIn.split(':');
    const allowedReturnTime = new Date(outpass.dateOfLeaving);
    allowedReturnTime.setHours(parseInt(hours), parseInt(minutes), 0);

    const isLate = currentTime > allowedReturnTime;
    console.log('⏰ Late check:', { currentTime, allowedReturnTime, isLate });

    // 🚫 4. Avoid duplicate logging
    const existingLog = await LocationLog.findOne({ outpassId, studentId });
    if (existingLog) {
      console.log('🔄 Duplicate location log found');
      return res.status(200).json({ message: "Location already logged for this outpass." });
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
    console.log('✅ Location saved to LocationLog');

    // 📍 6. Also attach location in outpass doc if student is late
    if (isLate) {
      outpass.lateLocation = {
        latitude,
        longitude,
        capturedAt: new Date()
      };
      await outpass.save();
      console.log('📍 Late location saved to outpass');
    }

    // ✅ 7. Respond to frontend
    return res.status(200).json({
      message: isLate
        ? '⚠️ You are late. Your location has been sent to the warden.'
        : '✅ Location recorded successfully.',
      isLate
    });

  } catch (error) {
    console.error('❌ Error submitting location:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

