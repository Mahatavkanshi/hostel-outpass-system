const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
require("dotenv").config();

router.post("/", async (req, res) => {
  console.log("Hit contact route");
  const { name, email, message } = req.body;
  console.log("Contact form data:", req.body);
  if (!name || !email || !message) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.WARDEN_EMAIL,
      to: email,
      subject: `New Message from ${name}`,
      html: `
        <p><strong>From:</strong> ${name} (${email})</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(
      `Email sent successfully from ${process.env.EMAIL_USER} to ${email}`
    );
    res.status(200).json({ message: "Email sent successfully!" });
  } catch (err) {
    console.error("Email error:", err);
    res.status(500).json({ message: "Error sending email." });
  }
});

module.exports = router;
