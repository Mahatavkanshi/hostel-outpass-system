const cron = require('node-cron');
const { sendLateEmailsToStudents } = require('../controllers/sendLateMails.controller');
const ApprovedOutpass = require('../models/approvedOutpass.model');
const Location = require('../models/location.model');
const User = require('../models/user.model');

// Run every hour
cron.schedule('0 * 19 * * *', async () => {
  console.log('⏰ Running late check...');

  const now = new Date();

  try {
    // Find students who are late (current time > inTime) and haven't returned
    const lateOutpasses = await ApprovedOutpass.find({
      timeIn: { $lt: now },
      isReturn: false,
      // We'll still send emails even if mailed before, as we want continuous reminders
    });

    console.log(`Found ${lateOutpasses.length} late students`);

    for (const outpass of lateOutpasses) {
      // Get user details
      const user = await User.findById(outpass.userId);
      if (!user) {
        console.log(`⚠️ No user found for ID: ${outpass.userId}`);
        continue;
      }

      // Send late notification email
      await sendLateEmailsToStudents([outpass._id]);

      // Get and update last known location
      const latestLocation = await Location.findOne({ userId: outpass.userId }).sort({ timestamp: -1 });
      if (latestLocation) {
        outpass.lastKnownLocation = {
          latitude: latestLocation.latitude,
          longitude: latestLocation.longitude,
          timestamp: latestLocation.timestamp
        };
        await outpass.save();
        console.log(`📍 Location updated for student: ${user.name}`);
      }
    }

    console.log("✅ Late student processing completed");
  } catch (err) {
    console.error("❌ Error in late student cron job:", err);
  }
}, {
  timezone: "Asia/Kolkata"
});
