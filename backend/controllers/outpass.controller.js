const Outpass = require('../models/outpass.model');
const ApprovedOutpass = require('../models/approvedOutpass.model.js'); 
const User = require('../models/user.model'); 

// 🚀 1. STUDENT: Submit an outpass request
exports.submitOutpass = async (req, res) => {
  const userId = req.user.userId;
  const {
    reason,
    placeOfVisit,
    dateOfLeaving,
    timeOut,
    timeIn,
    emergencyContact
  } = req.body;

  try {
    const outpass = await Outpass.create({
      userId,
      reason,
      placeOfVisit,
      dateOfLeaving,
      timeOut,
      timeIn,
      emergencyContact
    });

    res.status(201).json({ message: 'Outpass request submitted', outpass });
  } catch (err) {
    res.status(500).json({ message: 'Failed to submit request', error: err.message });
  }
};

// 🧑‍🏫 2. WARDEN: View all pending requests
exports.getPendingOutpasses = async (req, res) => {
  try {
    const requests = await Outpass.find({ status: 'pending' })
      .populate('userId', 'name collegeId email');
    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch requests', error: err.message });
  }
};

// ✅ 3. WARDEN: Approve or Reject an outpass
exports.reviewOutpass = async (req, res) => {
  const requestId = req.params.id;
  const { status, remarks } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    const request = await Outpass.findById(requestId);
    if (!request) return res.status(404).json({ message: 'Outpass not found' });

    request.status = status;
    request.reviewedBy = req.user.userId;
    request.reviewedAt = new Date();
    request.remarks = remarks;

    await request.save();
    
    // ✅ IF APPROVED: Create ApprovedOutpass entry
    if (status === 'approved') {

      // ⏱ Calculate expected return time from student's timeIn string
      const expectedReturn = new Date(request.dateOfLeaving);
      const [hours, minutes] = request.timeIn.split(':');
      expectedReturn.setHours(parseInt(hours), parseInt(minutes), 0);
      

      let currentTime = new Date();
      // ⏳ Check if student is late right now
      const isLate = currentTime > expectedReturn;

      const approvedData = {
        userId: request.userId,
        reason: request.reason,
        placeOfVisit: request.placeOfVisit,
        dateOfLeaving: request.dateOfLeaving,
        timeOut: request.timeOut,
        timeIn: request.timeIn,
        returnTime: request.returnTime || null,
        isOutpassValid: request.isOutpassValid || null,
        emergencyContact: request.emergencyContact,
        reviewedBy: request.reviewedBy,
        reviewedAt: request.reviewedAt,
        remarks: request.remarks,

        // ✅ NEW FIELDS:
        lateStatus: isLate ? 'late' : 'on-time',   // ⏳ Is student already late at approval time?
        isReturn: false,                       // ❌ Student hasn’t returned yet by default
        mailed: false,                     // ❌ Email not sent yet
        lateLocation: request.lateLocation,
        OutpassId: request._id
      };

      await ApprovedOutpass.create(approvedData);
      console.log('ApprovedOutpass created:', approvedData);
    }

    res.status(200).json({ message: `Outpass ${status}`, request});
    console.log(`Outpass ${status} by ${req.user.userId} with remarks: ${remarks}`);
    //console.log('ApprovedOutpass created:', approvedData);

  } catch (err) {
    res.status(500).json({ message: 'Failed to update request', error: err.message });
  }
};
        

// 👨‍🎓 4. STUDENT: View their own outpass history
exports.getStudentOutpasses = async (req, res) => {
  try {
    const requests = await Outpass.find({ userId: req.user.userId });
    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch history', error: err.message });
  }
};

// 🛡️ 5. GATEKEEPER: Mark student as returned
exports.markStudentReturned = async (req, res) => {
  const outpassId = req.params.id;

  try {
    const outpass = await Outpass.findById(outpassId);

    if (!outpass) {
      return res.status(404).json({ message: 'Outpass not found' });
    }

    if (outpass.status !== 'approved') {
      return res.status(400).json({ message: 'Only approved outpasses can be marked as returned' });
    }

    // Capture actual return time
    const now = new Date();
    outpass.returnTime = now;

    // Convert stored timeIn string ("17:00") to a real date
    const expectedReturn = new Date(outpass.dateOfLeaving);
    const [hours, minutes] = outpass.timeIn.split(':');
    expectedReturn.setHours(parseInt(hours), parseInt(minutes), 0);

    // Check if student returned on time
    outpass.isOutpassValid = now <= expectedReturn;
    // Update lateStatus based on actual return
    outpass.lateStatus = now > expectedReturn ? 'late' : 'on-time';

    await outpass.save();


    // ✅ FIX: Also update ApprovedOutpass
    await ApprovedOutpass.findOneAndUpdate(
      { originalOutpassId: outpassId },
      {
        returnTime: now,
        isOutpassValid: outpass.isOutpassValid,
        lateStatus: outpass.lateStatus,
        isReturn: true
      }
    );



    res.status(200).json({
      message: `Student marked as returned. Outpass is ${outpass.isOutpassValid ? 'VALID' : 'LATE'}.`,
      returnTime: outpass.returnTime,
      isOutpassValid: outpass.isOutpassValid
    });

  } catch (err) {
    res.status(500).json({ message: 'Failed to mark return', error: err.message });
  }
};

exports.getApprovedOutpassById = async (req, res) => {
  const id = req.params.id;
  const outpass = await ApprovedOutpass.findById(id);
  
  if (!outpass) {
    return res.status(404).json({ message: "Outpass not found" });
  }

  res.json(outpass);
};

// Helper: Euclidean distance between two 128-length arrays
function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] - b[i]);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

// Helper: Haversine distance (meters)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const toRad = x => x * Math.PI / 180;
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const dφ = toRad(lat2 - lat1), dλ = toRad(lon2 - lon1);
  const a = Math.sin(dφ/2) * Math.sin(dφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(dλ/2) * Math.sin(dλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
// Student marks return with face descriptors + GPS
exports.studentMarkReturn = async (req, res) => {
  try {
    const approvedId = req.params.id;           // ApprovedOutpass document id
    const userId = req.user.userId;             // set by auth middleware
    const { descriptors, lat, lng, accuracy } = req.body;

    // Basic validation
    if (!descriptors || !Array.isArray(descriptors) || descriptors.length === 0) {
      return res.status(400).json({ message: 'No descriptors provided' });
    }
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ message: 'Invalid location coordinates' });
    }

    // Load ApprovedOutpass
    const approved = await ApprovedOutpass.findById(approvedId);
    if (!approved) return res.status(404).json({ message: 'Approved outpass not found' });

    // Ensure requester owns this approved outpass
    if (String(approved.userId) !== String(userId)) {
      return res.status(403).json({ message: 'This outpass does not belong to you' });
    }

    if (approved.isReturn) {
      return res.status(400).json({ message: 'Outpass already marked as returned' });
    }

    // Load user with stored descriptors
    const user = await User.findById(userId);
    if (!user || !Array.isArray(user.faceDescriptors) || user.faceDescriptors.length === 0) {
      return res.status(400).json({ message: 'No enrolled face templates found. Please enroll face first.' });
    }

    // Compute best (minimum) euclidean distance across all pairs
    let bestDistance = Infinity;
    for (const live of descriptors) {
      if (!Array.isArray(live) || live.length !== 128) continue; // sanity
      for (const stored of user.faceDescriptors) {
        if (!Array.isArray(stored) || stored.length !== 128) continue;
        const d = euclideanDistance(stored, live);
        if (d < bestDistance) bestDistance = d;
      }
    }

    const FACE_THRESHOLD = parseFloat(process.env.FACE_THRESHOLD) || 0.58;
    if (bestDistance === Infinity || bestDistance > FACE_THRESHOLD) {
      return res.status(401).json({ message: 'Face not recognized', faceScore: bestDistance });
    }

    // Geo check: requires HOSTEL_LAT / HOSTEL_LNG in .env
    const HOSTEL_LAT = parseFloat(process.env.HOSTEL_LAT);
    const HOSTEL_LNG = parseFloat(process.env.HOSTEL_LNG);
    if (!HOSTEL_LAT || !HOSTEL_LNG) {
      return res.status(500).json({ message: 'Server misconfiguration: hostel coordinates not set' });
    }

   const REQUIRED_ACCURACY = parseFloat(process.env.REQUIRED_ACCURACY) || 300; // meters
if (accuracy && accuracy > REQUIRED_ACCURACY) {
  console.warn(`⚠️ GPS accuracy too low (${accuracy}m). Proceeding anyway.`);
  // don’t block, just warn
}

    const distanceMeters = haversineDistance(lat, lng, HOSTEL_LAT, HOSTEL_LNG);
    const GEOFENCE_RADIUS = parseFloat(process.env.GEO_RADIUS) || 80; // meters
    if (distanceMeters > GEOFENCE_RADIUS) {
      return res.status(403).json({ message: 'You are outside the hostel boundary', distanceMeters });
    }

    // All checks passed — record return
    const now = new Date();

    // Update original Outpass (if referenced)
    let originalOutpass = null;
    const outpassId = approved.OutpassId || approved.outpassId || approved.Outpass || approved.OutpassId;
    if (outpassId) {
      originalOutpass = await Outpass.findById(outpassId).catch(() => null);
      if (originalOutpass) {
        originalOutpass.returnTime = now;
        const expectedReturn = new Date(originalOutpass.dateOfLeaving);
        const [h, m] = (originalOutpass.timeIn || '00:00').split(':');
        expectedReturn.setHours(parseInt(h || '0'), parseInt(m || '0'), 0);
        originalOutpass.isOutpassValid = now <= expectedReturn;
        originalOutpass.lateStatus = now > expectedReturn ? 'late' : 'on-time';
        await originalOutpass.save().catch(err => console.warn('Failed to update original outpass', err));
      }
    }

    // Update ApprovedOutpass document
    const approvedUpdate = {
      returnTime: now,
      isReturn: true,
      isOutpassValid: originalOutpass ? originalOutpass.isOutpassValid : true,
      lateStatus: originalOutpass ? originalOutpass.lateStatus : 'on-time',
      lastReturn: {
        lat, lng, accuracy: accuracy || null, faceScore: bestDistance, distanceMeters, returnedAt: now
      }
    };
    await ApprovedOutpass.findByIdAndUpdate(approvedId, approvedUpdate);

    // Respond with useful info
    return res.json({
      success: true,
      message: 'Return verified and recorded',
      faceScore: bestDistance,
      distanceMeters
    });

  } catch (err) {
    console.error('studentMarkReturn error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};
