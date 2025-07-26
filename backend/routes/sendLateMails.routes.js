const express = require('express');
const router = express.Router();
const { sendLateEmailsToStudents } = require('../controllers/sendLateMails.controller');

router.get('/send-late-mails', async (req, res) => {
  try {
    const result = await sendLateEmailsToStudents();
    res.status(200).json({ message: '✅ Checked for late students and sent mails (if any).' });
  } catch (error) {
    res.status(500).json({ message: '❌ Error while sending emails', error });
  }
});

module.exports = router;

