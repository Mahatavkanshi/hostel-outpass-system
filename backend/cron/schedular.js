const cron = require('node-cron');
const { sendLateEmailsToStudents } = require('../controllers/sendLateMails.controller');
const ApprovedOutpass = require('../models/approvedOutpass.model');
const Location = require('../models/location.model');
const User = require('../models/user.model');

// Run every 2 minutes
cron.schedule('*/2 * * * *', async () => {
  console.log('⏰ Running late check...');

  const now = new Date();

  try {
    // Update lateStatus for all outpasses where isReturn is false and current time > expected return time
    const outpassesToUpdate = await ApprovedOutpass.find({
      isReturn: false,
    });

    for (const outpass of outpassesToUpdate) {
      // Calculate expected return datetime in UTC
      const expectedReturn = new Date(outpass.dateOfLeaving);
      let hours = 0, minutes = 0;
      if (outpass.timeIn && typeof outpass.timeIn === 'string') {
        [hours, minutes] = outpass.timeIn.split(":");
        expectedReturn.setHours(parseInt(hours), parseInt(minutes), 0, 0); // Use local time
      } else {
        console.error('Invalid timeIn format for outpass:', outpass._id, outpass.timeIn);
      }
      const now = new Date();
      console.log(`Checking outpass ${outpass._id}: now=${now.toISOString()}, dateOfLeaving=${outpass.dateOfLeaving}, timeIn=${outpass.timeIn}`);
      console.log(`Expected return (UTC): ${expectedReturn.toISOString()}`);
      console.log(`lateStatus: ${outpass.lateStatus}, isReturn: ${outpass.isReturn}`);
      if (now > expectedReturn && outpass.lateStatus !== "late") {
        outpass.lateStatus = "late";
        await outpass.save();
        console.log(`⏳ Marked as late: ${outpass._id}`);
      }
    }

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
      const latestLocation = await Location.findOne({ studentId: outpass.userId }).sort({ timestamp: -1 });
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
