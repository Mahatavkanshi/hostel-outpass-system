const Outpass = require('../models/outpass.model');
const ApprovedOutpass = require('../models/approvedOutpass.model.js');

/* 1) STUDENT: Submit an outpass */
exports.submitOutpass = async (req, res) => {
  const userId = req.user.userId;
  const { reason, placeOfVisit, dateOfLeaving, timeOut, timeIn, emergencyContact } = req.body;

  try {
    const outpass = await Outpass.create({
      userId, reason, placeOfVisit, dateOfLeaving, timeOut, timeIn, emergencyContact
    });
    res.status(201).json({ message: 'Outpass request submitted', outpass });
  } catch (err) {
    res.status(500).json({ message: 'Failed to submit request', error: err.message });
  }
};

/* 2) WARDEN: View pending requests */
exports.getPendingOutpasses = async (req, res) => {
  try {
    const requests = await Outpass.find({ status: 'pending' })
      .populate('userId', 'name collegeId email');
    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch requests', error: err.message });
  }
};

/* 3) WARDEN: Approve/Reject */
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

    if (status === 'approved') {
      const expectedReturn = new Date(request.dateOfLeaving);
      const [hours, minutes] = (request.timeIn || '00:00').split(':');
      expectedReturn.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

      const currentTime = new Date();
      const isLate = currentTime > expectedReturn;

      const approvedData = {
        userId: request.userId,
        reason: request.reason,
        placeOfVisit: request.placeOfVisit,
        dateOfLeaving: request.dateOfLeaving,
        timeOut: request.timeOut,
        timeIn: request.timeIn,
        returnTime: null,
        isOutpassValid: true,
        emergencyContact: request.emergencyContact,
        reviewedBy: request.reviewedBy,
        reviewedAt: request.reviewedAt,
        remarks: request.remarks,
        lateStatus: isLate ? 'late' : 'on-time',
        isReturn: false,
        mailed: false,
        lateLocation: request.lateLocation,
        OutpassId: request._id
      };

      await ApprovedOutpass.create(approvedData);
    }

    res.status(200).json({ message: `Outpass ${status}`, request });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update request', error: err.message });
  }
};

/* 4) STUDENT: Own history */
exports.getStudentOutpasses = async (req, res) => {
  try {
    const requests = await Outpass.find({ userId: req.user.userId });
    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch history', error: err.message });
  }
};

/* 5) SINGLE approved outpass by ID — this was missing */
exports.getApprovedOutpassById = async (req, res) => {
  try {
    const { id } = req.params;
    const outpass = await ApprovedOutpass.findById(id)
      .populate('userId', 'name email collegeId');
    if (!outpass) return res.status(404).json({ message: 'Outpass not found' });
    res.json({ success: true, data: outpass });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

/* 6) GATEKEEPER: list NOT returned — keep ONE definition only */
exports.getPendingReturns = async (req, res) => {
  try {
    const pendingReturns = await ApprovedOutpass.find({ isReturn: false })
      .populate('userId', 'name email collegeId')
      .sort({ dateOfLeaving: -1 });
    res.json({ success: true, data: pendingReturns });
  } catch (err) {
    console.error('getPendingReturns error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* 7) GATEKEEPER: mark ONE student returned */
exports.markStudentReturned = async (req, res) => {
  try {
    const { id } = req.params; // ApprovedOutpass _id
    const op = await ApprovedOutpass.findById(id);
    if (!op) return res.status(404).json({ message: 'Outpass not found' });
    if (op.isReturn) return res.status(400).json({ message: 'Student already marked as returned' });

    const now = new Date();
    const expectedReturn = new Date(op.dateOfLeaving);
    const [h, m] = (op.timeIn || '00:00').split(':');
    expectedReturn.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);

    op.isReturn = true;
    op.returnTime = now;
    op.isOutpassValid = false;
    op.lateStatus = now > expectedReturn ? 'late' : 'on-time';

    await op.save();
    res.status(200).json({ message: 'Student marked as returned', outpass: op });
  } catch (err) {
    console.error('Error in markStudentReturned:', err);
    res.status(500).json({ message: 'Failed to mark as returned', error: err.message });
  }
};

/* 8) GATEKEEPER: mark ALL (or selected) returned */
exports.markAllReturned = async (req, res) => {
  try {
    const now = new Date();
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;

    const filter = { isReturn: false };
    if (ids && ids.length) filter._id = { $in: ids };

    const outpasses = await ApprovedOutpass.find(filter);

    let updatedCount = 0;
    for (const op of outpasses) {
      const expectedReturn = new Date(op.dateOfLeaving);
      const [h, m] = (op.timeIn || '00:00').split(':');
      expectedReturn.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);

      op.isReturn = true;
      op.returnTime = now;
      op.isOutpassValid = false;
      op.lateStatus = now > expectedReturn ? 'late' : 'on-time';
      await op.save();
      updatedCount++;
    }

    res.status(200).json({ message: `${updatedCount} students marked as returned.`, updatedCount });
  } catch (err) {
    console.error('Error in markAllReturned:', err);
    res.status(500).json({ message: 'Failed to mark all as returned', error: err.message });
  }
};



 



