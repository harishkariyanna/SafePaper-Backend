require('dotenv').config();
const connectDB = require('../config/database');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function createAdmin() {
  try {
    await connectDB();
    
    const adminExists = await User.findOne({ email: 'admin@safepaper.in' });
    if (adminExists) {
      console.log('Admin already exists');
      return;
    }

    const hashedPassword = await bcrypt.hash('admin', 10);
    const admin = new User({
      email: 'admin@safepaper.in',
      password: hashedPassword,
      role: 'top-admin'
    });

    await admin.save();
    console.log('Admin created successfully');
  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    process.exit();
  }
}

createAdmin();
