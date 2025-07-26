const Profile = require('../models/profile.model');

exports.updateProfile = async (req, res) => {
  const { contactNumber, parentContact, address, gender, roomNumber, emergencyContact } = req.body;
  const userId = req.user.userId;

  try {
    const updated = await Profile.findOneAndUpdate(
      { userId },
      { contactNumber, parentContact, address, gender, roomNumber, emergencyContact },
      { upsert: true, new: true }
    );

    res.status(200).json({
      message: 'Profile updated successfully',
      profile: updated
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update profile', error: err.message });
  }
};

exports.getProfile = async (req, res) => {
  const userId = req.user.userId;

  try {
    const profile = await Profile.findOne({ userId });
    if (!profile) return res.status(404).json({ message: 'Profile not found' });

    res.status(200).json({ profile });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch profile', error: err.message });
  }
};
