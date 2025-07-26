const express = require('express');
const router = express.Router();
const {
  sendVerificationRequest,
  getPendingRequests,
  reviewRequest
} = require('../controllers/verification.controller');

const auth = require('../middlewares/auth.middleware');
const restrictTo = require('../middlewares/role.middleware');

router.use(auth);

// Student route
router.post('/', restrictTo('student'), sendVerificationRequest);

// Warden routes
router.get('/pending', restrictTo('warden'), getPendingRequests);
router.put('/:id', restrictTo('warden'), reviewRequest);

module.exports = router;
