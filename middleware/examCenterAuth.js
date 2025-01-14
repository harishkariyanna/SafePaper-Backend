const jwt = require('jsonwebtoken');
const User = require('../models/User');

const examCenterAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ _id: decoded.user.id, role: 'exam-center' });

    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'Exam center access required'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid authentication'
    });
  }
};

module.exports = examCenterAuth; 