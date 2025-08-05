// Step 1: Import models
const approvedOutpass = require('../models/approvedOutpass.model');
const User = require('../models/user.model');
const nodemailer = require('nodemailer');

// Helper function to send a single email
const sendLateMail = async (email, name, outpass) => {
  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  // Correctly construct expected return time
  let expectedReturn = new Date(outpass.dateOfLeaving);
  let minutesLate = 0;
  try {
    if (outpass.timeIn && typeof outpass.timeIn === 'string') {
      const [hours, minutes] = outpass.timeIn.split(":");
      expectedReturn.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      const now = new Date();
      minutesLate = Math.floor((now - expectedReturn) / (1000 * 60));
    } else {
      console.error('Invalid timeIn format for outpass:', outpass._id, outpass.timeIn);
    }
  } catch (err) {
    console.error('Error parsing expected return time for outpass:', outpass._id, err);
  }

  const mailOptions = {
    from: 'Hostel Warden <mahatavkanshisaini@gmail.com>',
    to: email,
    subject: '⚠️ URGENT: You are Late - Please Return to Hostel',
    text: `Hello ${name},

⚠️ URGENT REMINDER: You are ${minutesLate} minutes late to return to the hostel!

📍 Place of Visit: ${outpass.placeOfVisit}
🕒 Expected Return Time: ${expectedReturn.toLocaleTimeString()}
📅 Date of Leaving: ${expectedReturn.toDateString()}

Please return to the hostel IMMEDIATELY or contact the warden if you have an emergency.

This is an automated reminder sent every 2 minutes until you return.

Regards,
Hostel Admin`
  };

  await transporter.sendMail(mailOptions);
};

// Main function to send late emails
const sendLateEmailsToStudents = async (outpassIds = []) => {
  try {
    // Find late outpasses
    const query = {
      isReturn: false,
      lateStatus: "late",
      mailed: false
    };
    
    // If specific outpass IDs provided, only process those
    if (outpassIds.length > 0) {
      query._id = { $in: outpassIds };
    }

    const lateOutpasses = await approvedOutpass.find(query);

    if (lateOutpasses.length === 0) {
      console.log('✅ No late students to email.');
      return;
    }

    // Process each late outpass
    for (let outpass of lateOutpasses) {
      const user = await User.findById(outpass.userId);
      if (!user) {
        console.log(`❌ User not found for outpass ${outpass._id}`);
        continue;
      }
  
      console.log(`📧 Sending late reminder to ${user.name} (${user.email})`);
  
      try {
        await sendLateMail(user.email, user.name, outpass);
        console.log(`✅ Reminder sent to ${user.name}`);
        // Mark as mailed so only one email is sent
        outpass.mailed = true;
        await outpass.save();
      } catch (emailError) {
        console.error(`❌ Failed to send email to ${user.name}:`, emailError);
      }
    }

  }catch (error) {
    console.error('❌ Error in sendLateEmailsToStudents:', error);
  }
};


module.exports = { sendLateEmailsToStudents };



