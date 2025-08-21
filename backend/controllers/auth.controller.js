const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/jwt');
const path = require('path');

exports.signup = async (req, res) => {
    console.log('BODY:', req.body);

  const { name, collegeId, email, password, role } = req.body;

  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
        // 🔗 Build a public URL for the uploaded image
    let faceImageUrl = null;
    if (req.file) {
      // multer gives you filename we set above
      const filename = req.file.filename;
      // e.g. http://localhost:5000/uploads/1724234234234.jpeg
      faceImageUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
    }

    const user = await User.create({
      name,
      collegeId,
      email,
      password: hashedPassword,
      role,     
       faceImage: faceImageUrl
  // ✅ Save image path                           
    });

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
        faceImage: user.faceImage
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Signup failed', error: err.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });
    console.log("User data in login",user)

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = generateToken(user._id, user.role);
    console.log("Token generated in login",token);

    res.status(200).json({
       success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};
