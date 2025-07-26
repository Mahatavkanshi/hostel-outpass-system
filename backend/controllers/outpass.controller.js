const Outpass = require('../models/outpass.model');
const ApprovedOutpass = require('../models/approvedOutpass.model.js'); 


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
      // 🕒 Get current time (now)
      const now = new Date();

      // ⏱ Calculate expected return time from student's timeIn string
      const expectedReturn = new Date(request.dateOfLeaving);
      const [hours, minutes] = request.timeIn.split(':');
      expectedReturn.setHours(parseInt(hours), parseInt(minutes), 0);

      // ⏳ Check if student is late right now
      const isLate = now > expectedReturn;

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
        originalOutpassId: request._id
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

    await outpass.save();

    res.status(200).json({
      message: `Student marked as returned. Outpass is ${outpass.isOutpassValid ? 'VALID' : 'LATE'}.`,
      returnTime: outpass.returnTime,
      isOutpassValid: outpass.isOutpassValid
    });

  } catch (err) {
    res.status(500).json({ message: 'Failed to mark return', error: err.message });
  }
};

