const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const adminAuth = require('../middleware/adminAuth');

// Create user
router.post('/', adminAuth, userController.createUser);

// Get all users (can filter by role using query parameter)
router.get('/', adminAuth, userController.getAllUsers);

// Delete user
router.delete('/:id', adminAuth, userController.deleteUser);

module.exports = router;
