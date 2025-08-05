// Test script to verify location functionality
const mongoose = require('mongoose');
const ApprovedOutpass = require('./models/approvedOutpass.model');
const LocationLog = require('./models/location.model');
const User = require('./models/user.model');

// Connect to database
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hostel-outpass-system');

async function testLocationFunctionality() {
  try {
    console.log('🧪 Testing location functionality...');
    
    // 1. Check if there are any approved outpasses
    const outpasses = await ApprovedOutpass.find({});
    console.log(`📋 Found ${outpasses.length} total outpasses`);
    
    // 2. Check late outpasses
    const lateOutpasses = await ApprovedOutpass.find({ lateStatus: 'late' });
    console.log(`⏰ Found ${lateOutpasses.length} late outpasses`);
    
    // 3. Check location logs
    const locationLogs = await LocationLog.find({});
    console.log(`📍 Found ${locationLogs.length} location logs`);
    
    // 4. Show sample data
    if (lateOutpasses.length > 0) {
      console.log('📊 Sample late outpass:', {
        id: lateOutpasses[0]._id,
        userId: lateOutpasses[0].userId,
        lateLocation: lateOutpasses[0].lateLocation,
        lateStatus: lateOutpasses[0].lateStatus
      });
    }
    
    if (locationLogs.length > 0) {
      console.log('📊 Sample location log:', {
        id: locationLogs[0]._id,
        studentId: locationLogs[0].studentId,
        outpassId: locationLogs[0].outpassId,
        latitude: locationLogs[0].latitude,
        longitude: locationLogs[0].longitude,
        status: locationLogs[0].status
      });
    }
    
    console.log('✅ Test completed');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    mongoose.connection.close();
  }
}

testLocationFunctionality(); 