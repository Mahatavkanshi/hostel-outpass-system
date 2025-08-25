const express = require('express');
const router = express.Router();
// at top near other imports:
const { studentMarkReturn } = require('../controllers/outpass.controller');
const Outpass = require("../models/outpass.model"); 

const moment = require("moment");


const {
  submitOutpass,
  getPendingOutpasses,
  reviewOutpass,
  getStudentOutpasses,
  markStudentReturned,
  getApprovedOutpassById
} = require('../controllers/outpass.controller');

const {
  submitLocation
} = require('../controllers/location.controller'); // We'll create this next

const ApprovedOutpass = require('../models/approvedOutpass.model');

const auth = require('../middlewares/auth.middleware');
const restrictTo = require('../middlewares/role.middleware');


router.use(auth);

// Student routes
router.post('/', restrictTo('student'), submitOutpass);
router.get('/my', restrictTo('student'), getStudentOutpasses);
// student route to mark return (uses ApprovedOutpass id)
router.post('/approved/:id/mark-return', restrictTo('student'), studentMarkReturn);


// ✅ Import the model

// ✅ Get approved outpasses for a specific student
router.get('/approved/:userId', restrictTo('student'), async (req, res) => {
  try {
    const { userId } = req.params;
    const outpasses = await ApprovedOutpass.find({
      userId: userId
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
router.post('/:id/location', restrictTo('student'), (req, res, next) => {
  console.log('📍 Location route hit:', { 
    method: req.method, 
    url: req.url, 
    params: req.params, 
    body: req.body 
  });
  next();
}, submitLocation);

// Warden routes
router.get('/pending', restrictTo('warden'), getPendingOutpasses);
router.put('/:id', restrictTo('warden'), reviewOutpass);

// ✅ Warden-only route to get late students' locations (MOVE THIS BEFORE /approved/:id)
router.get('/late-locations', restrictTo('warden'), async (req, res) => {
  try {
    console.log('🔍 Fetching late students...');
    const lateOutpasses = await ApprovedOutpass.find({
      lateStatus: 'late'
    }).populate('userId', 'name email collegeId'); // Assuming userId is referenced

    console.log(`📊 Found ${lateOutpasses.length} late outpasses`);
    console.log('📋 Late outpasses:', lateOutpasses.map(o => ({
      id: o._id,
      userId: o.userId?.name,
      lateLocation: o.lateLocation
    })));

    if (!lateOutpasses.length) {
      return res.json({ 
        success: true, 
        data: [],
        message: 'No late students found' 
      });
    }

    // ✅ Format data to match frontend expectations
    const locationData = lateOutpasses.map(entry => ({
      userId: {
        name: entry.userId.name,
        collegeId: entry.userId.collegeId,
        email: entry.userId.email
      },
      latitude: entry.lateLocation?.latitude || 'N/A',
      longitude: entry.lateLocation?.longitude || 'N/A',
      capturedAt: entry.lateLocation?.capturedAt || entry.updatedAt
    }));

    res.json({ 
      success: true, 
      data: locationData 
    });
  } catch (err) {
    console.error('❌ Error fetching late locations:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Gatekeeper routes
router.post(
  '/outpass/:id/mark-returned',
  auth,             // checks token
  restrictTo('gatekeeper'),  // ensures gatekeeper
  markStudentReturned         // controller logic
);

// ✅ Move this route AFTER late-locations to prevent conflicts
router.get('/approved/:id', getApprovedOutpassById);

// ✅ Get today's outpasses (for the warden list)
router.get("/today", restrictTo('warden'), async (req, res) => {
  try {
    const startOfDay = moment().startOf("day").toDate();
    const endOfDay = moment().endOf("day").toDate();

    // Query the Outpass collection (requests), not ApprovedOutpass
    const outpasses = await Outpass.find({
      dateOfLeaving: { $gte: startOfDay, $lte: endOfDay }
    }).populate("userId", "name collegeId email");

    res.json({ success: true, data: outpasses });
  } catch (err) {
    console.error("❌ Error fetching today's outpasses", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});


module.exports = router;
