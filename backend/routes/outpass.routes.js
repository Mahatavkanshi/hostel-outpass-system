const express = require('express');
const router = express.Router();

const {
  submitOutpass,
  getPendingOutpasses,
  reviewOutpass,
  getStudentOutpasses,
  markStudentReturned
} = require('../controllers/outpass.controller');
const {
  submitLocation
} = require('../controllers/location.controller'); // We’ll create this next


const auth = require('../middlewares/auth.middleware');
const restrictTo = require('../middlewares/role.middleware');


router.use(auth);

// Student routes
router.post('/', restrictTo('student'), submitOutpass);
router.get('/my', restrictTo('student'), getStudentOutpasses);

const ApprovedOutpass = require('../models/approvedOutpass.model'); // ✅ Import the model

// ✅ Get approved outpasses for a specific student
router.get('/approved/:userId', restrictTo('student'), async (req, res) => {
  try {
    const { userId } = req.params;
    const outpasses = await ApprovedOutpass.find({
      studentId: userId,
      status: 'approved'
    });

    if (!outpasses || outpasses.length === 0) {
      return res.status(404).json({ message: 'No approved outpasses found' });
    }

    res.json({ data: outpasses });
  } catch (err) {
    console.error('Error fetching approved outpasses:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Route to log location if student is late
router.post('/:id/location', restrictTo('student'), submitLocation);

// Warden routes
router.get('/pending', restrictTo('warden'), getPendingOutpasses);
router.put('/:id', restrictTo('warden'), reviewOutpass);

// Gatekeeper routes
router.post(
  '/outpass/:id/mark-returned',
  auth,             // checks token
  restrictTo('gatekeeper'),  // ensures gatekeeper
  markStudentReturned         // controller logic
);



module.exports = router;
