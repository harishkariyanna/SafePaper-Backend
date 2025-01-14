const express = require("express");
const router = express.Router();
const examController = require("../controllers/examController");
const adminAuth = require("../middleware/adminAuth");
const guardianAuth = require("../middleware/guardianAuth");
const examCenterAuth = require("../middleware/examCenterAuth");

// Admin routes
router.get("/current", adminAuth, examController.getCurrentExam);
router.post("/schedule", adminAuth, examController.scheduleExam);
router.delete("/:id", adminAuth, examController.deleteExam);

// Guardian routes
router.post("/submit-key", guardianAuth, examController.submitGuardianKey);
router.get("/key-status", guardianAuth, examController.checkKeySubmissionStatus);

// Exam center routes
router.get("/exam-center-details", examCenterAuth, examController.getExamCenterExamDetails);
router.post("/request-paper", examCenterAuth, examController.requestPaper);

module.exports = router; 