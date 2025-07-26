const VerificationRequest = require('../models/verification.model');
const User = require('../models/user.model');

exports.sendVerificationRequest = async (req, res) => {
  const userId = req.user.userId;

  try {
    const exists = await VerificationRequest.findOne({ userId });
    if (exists) return res.status(400).json({ message: 'Request already submitted' });

    const request = await VerificationRequest.create({ userId });
    res.status(201).json({ message: 'Verification request sent', request });
  } catch (err) {
    res.status(500).json({ message: 'Failed to send request', error: err.message });
  }
};

exports.getPendingRequests = async (req, res) => {
  try {
    const pending = await VerificationRequest.find({ status: 'pending' }).populate('userId', 'name email collegeId');
    res.status(200).json(pending);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch requests', error: err.message });
  }
};

exports.reviewRequest = async (req, res) => {
  const requestId = req.params.id;
  const { status, remarks } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    const request = await VerificationRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    request.status = status;
    request.reviewedBy = req.user.userId;
    request.reviewedAt = new Date();
    request.remarks = remarks;

    await request.save();

    if (status === 'approved') {
      await User.findByIdAndUpdate(request.userId, { isVerified: true });
    }

    res.status(200).json({ message: `Request ${status}`, request });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update request', error: err.message });
  }
};
