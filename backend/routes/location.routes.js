const express = require('express');
const mongoose = require('mongoose');  // ✅ Needed for ObjectId conversion
const router = express.Router();
const ApprovedOutpass = require('../models/approvedOutpass.model');

// ================================
// 1. Save location of late student
// ================================
// router.post('/submit', async (req, res) => {
//   const { userId, latitude, longitude, capturedAt } = req.body;

//   if (!userId || !latitude || !longitude) {
//     return res.status(400).json({ message: 'Missing data' });
//   }

//   try {
//     const objectUserId = new mongoose.Types.ObjectId(userId); // ✅ Correct conversion

//     const updated = await ApprovedOutpass.findOneAndUpdate(
//       { userId: objectUserId, lateStatus: 'late' }, // ✅ Now matches correctly
//       {
//         lateLocation: {
//           latitude,
//           longitude,
//           capturedAt: capturedAt || new Date()
//         }
//       },
//       { new: true }
//     );

//     if (!updated) {
//       return res.status(404).json({ message: 'Student not found or not late' });
//     }

//     res.json({ message: 'Location saved', data: updated });
//   } catch (err) {
//     console.error('Error:', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// =============================================
// 2. Get all late students with their location
// =============================================
router.get('/late-students', async (req, res) => {
  try {
    const lateStudents = await ApprovedOutpass.find({ lateStatus: 'late' });

    res.json({ data: lateStudents });
  } catch (err) {
    console.error('Error fetching late students:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;


