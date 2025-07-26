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

  // Calculate minutes late
  const timeIn = new Date(outpass.timeIn);
  const now = new Date();
  const minutesLate = Math.floor((now - timeIn) / (1000 * 60));

  const mailOptions = {
    from: 'Hostel Warden <mahatavkanshisaini@gmail.com>',
    to: email,
    subject: '⚠️ URGENT: You are Late - Please Return to Hostel',
    text: `Hello ${name},

⚠️ URGENT REMINDER: You are ${minutesLate} minutes late to return to the hostel!

📍 Place of Visit: ${outpass.placeOfVisit}
🕒 Expected Return Time: ${new Date(outpass.timeIn).toLocaleTimeString()}
📅 Date of Leaving: ${new Date(outpass.dateOfLeaving).toDateString()}

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
      } catch (emailError) {
        console.error(`❌ Failed to send email to ${user.name}:`, emailError);
      }
    }

  } catch (error) {
    console.error('❌ Error in sendLateEmailsToStudents:', error);
  }
};

module.exports = { sendLateEmailsToStudents };



