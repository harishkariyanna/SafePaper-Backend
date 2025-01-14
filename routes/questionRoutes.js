const express = require("express");
const router = express.Router();
const questionController = require("../controllers/questionController");
const paperSetterAuth = require("../middleware/paperSetterAuth");

// Get all guardians (only accessible by paper setters)
router.get("/guardians", paperSetterAuth, questionController.getAllGuardians);

// Create questions (only paper setters)
router.post("/", paperSetterAuth, questionController.createQuestion);

module.exports = router;
