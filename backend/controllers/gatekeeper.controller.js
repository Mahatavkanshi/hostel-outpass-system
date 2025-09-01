const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');

// POST /api/gatekeeper/login
exports.loginGatekeeper = async (req, res) => {
  const { email, password } = req.body;

  try {
    const gatekeeper = await User.findOne({ email, role: 'gatekeeper' });
    if (!gatekeeper) {
      return res.status(401).json({ message: 'Invalid credentials or not a gatekeeper' });
    }

    const isMatch = await bcrypt.compare(password, gatekeeper.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: gatekeeper._id, role: gatekeeper.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: gatekeeper._id,
        name: gatekeeper.name,
        email: gatekeeper.email,
        role: gatekeeper.role
      }
    });

  } catch (err) {
    console.error('Gatekeeper login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
