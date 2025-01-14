const Exam = require('../models/Exam');
const Question = require('../models/Question');
const User = require('../models/User');
const { sendExamNotification } = require('../utils/emailService');
const EncryptionService = require('../utils/encryption');

exports.scheduleExam = async (req, res) => {
  try {
    // Check for existing active exam
    const existingExam = await Exam.findOne({ 
      status: { $in: ['scheduled', 'in-progress'] } 
    });

    if (existingExam) {
      return res.status(400).json({
        success: false,
        message: 'An exam is already scheduled or in progress'
      });
    }

    const { date, startTime, endTime } = req.body;

    // Validate if date is in future
    const examDate = new Date(date);

    // Get all guardians
    const guardians = await User.find({ role: 'guardian' });
    if (guardians.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No guardians found in the system'
      });
    }

    // Get random 25 questions
    const questions = await Question.aggregate([
      { $sample: { size: 25 } }
    ]);

    if (questions.length < 25) {
      return res.status(400).json({
        success: false,
        message: 'Not enough questions in the system'
      });
    }

    // Create exam
    const exam = new Exam({
      date: examDate,
      startTime,
      endTime,
      guardianKeys: guardians.map(guardian => ({
        guardian: guardian._id
      })),
      selectedQuestions: questions.map(q => q._id)
    });

    await exam.save();

    // Send notifications to guardians
    for (const guardian of guardians) {
      await sendExamNotification(
        guardian.email,
        {
          date: examDate,
          startTime,
          endTime
        }
      );
    }

    res.status(201).json({
      success: true,
      message: 'Exam scheduled successfully'
    });

  } catch (error) {
    console.log('Schedule exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Error scheduling exam'
    });
  }
};

exports.getCurrentExam = async (req, res) => {
  try {
    const exam = await Exam.findOne({ status: { $in: ['scheduled', 'in-progress'] } })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: exam
    });
  } catch (error) {
    console.error('Get current exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching current exam'
    });
  }
};

exports.deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    if (exam.status === 'in-progress') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete an exam that is in progress'
      });
    }

    await Question.deleteMany({});

    await exam.deleteOne();

    res.json({
      success: true,
      message: 'Exam and its questions deleted successfully'
    });
  } catch (error) {
    console.error('Delete exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting exam'
    });
  }
};

exports.submitGuardianKey = async (req, res) => {
  try {
    const { key } = req.body;

    const exam = await Exam.findOne({ 
      status: { $in: ['scheduled', 'in-progress'] },
      'guardianKeys.guardian': req.user.id
    });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'No active exam found'
      });
    }

    const guardianKeyIndex = exam.guardianKeys.findIndex(
      gk => gk.guardian.toString() === req.user.id.toString()
    );

    if (exam.guardianKeys[guardianKeyIndex].keySubmitted) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted your key'
      });
    }

    exam.guardianKeys[guardianKeyIndex].keySubmitted = true;
    exam.guardianKeys[guardianKeyIndex].key = key;
    exam.guardianKeys[guardianKeyIndex].submittedAt = new Date();

    await exam.save();

    res.json({
      success: true,
      message: 'Key submitted successfully'
    });

  } catch (error) {
    console.error('Submit guardian key error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting key'
    });
  }
};

exports.checkKeySubmissionStatus = async (req, res) => {
  try {
    const exam = await Exam.findOne({ 
      status: { $in: ['scheduled', 'in-progress'] },
      'guardianKeys.guardian': req.user.id
    });

    if (!exam) {
      return res.json({
        success: true,
        hasSubmitted: false,
        message: 'No active exam found'
      });
    }

    const guardianKey = exam.guardianKeys.find(
      gk => gk.guardian.toString() === req.user.id.toString()
    );

    res.json({
      success: true,
      hasSubmitted: guardianKey.keySubmitted,
      examDetails: {
        date: exam.date,
        startTime: exam.startTime,
        endTime: exam.endTime,
        status: exam.status
      }
    });

  } catch (error) {
    console.error('Check key submission status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking key submission status'
    });
  }
};

exports.getExamCenterExamDetails = async (req, res) => {
  try {

    const exam = await Exam.findOne({ 
      status: { $in: ['scheduled', 'in-progress'] } 
    }).select('date startTime endTime status decodedQuestions');

    if (!exam) {
      return res.json({
        success: true,
        message: 'No active exam found'
      });
    }

    // Only send decoded questions if they exist
    const examResponse = {
      date: exam.date,
      startTime: exam.startTime,
      endTime: exam.endTime,
      status: exam.status,
      hasDecodedQuestions: exam.decodedQuestions.length > 0
    };

    if (exam.decodedQuestions.length > 0) {
      console.log(`Found ${exam.decodedQuestions.length} decoded questions`);
      examResponse.questions = exam.decodedQuestions.map(q => ({
        id: q.questionId,
        question: q.question,
        options: q.options
      }));
    }

    res.json({
      success: true,
      examDetails: examResponse
    });

  } catch (error) {
    console.error('Get exam center exam details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching exam details'
    });
  }
};

exports.requestPaper = async (req, res) => {
  try {
    console.log('Processing paper request...');
    const now = new Date();

    const exam = await Exam.findOne({ 
      status: 'scheduled',
      decodedQuestions: { $size: 0 }
    }).populate({
      path: 'selectedQuestions',
      populate: { path: 'guardians' }
    }).populate('guardianKeys.guardian');

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'No scheduled exam found'
      });
    }

    // Check if within 5 minutes of exam start
    const examDate = new Date(exam.date);
    const [hours, minutes] = exam.startTime.split(':');
    examDate.setHours(parseInt(hours), parseInt(minutes));

    const timeDiff = (examDate - now) / (1000 * 60);
    console.log(`Time until exam start: ${timeDiff.toFixed(2)} minutes`);

    const decodedQuestions = [];

    // Process each question individually
    for (const question of exam.selectedQuestions) {
      try {
        console.log(`Processing question ID: ${question._id}`);
        
        const questionGuardianIds = question.guardians.map(g => g._id.toString());
        console.log(questionGuardianIds);
        const relevantKeys = exam.guardianKeys
          .filter(gk => questionGuardianIds.includes(gk.guardian._id.toString()))
          .map(gk => {
            if (gk.key) { // Check if key exists
              try {
                // Removed Buffer conversion
                const key = gk.key; 
                console.log(`Key for guardian ${gk.guardian._id}:`, key); // Log the key of the guardian
                return key;
              } catch (error) {
                console.error(`Error processing key for guardian ${gk.guardian._id}:`, error);
                return null; // Return null if there's an error
              }
            } else {
              console.error(`Key for guardian ${gk.guardian._id} is undefined`);
              return null; // Return null if key is undefined
            }
          })
          .filter(key => key !== null); // Filter out any null keys

        // Allow processing if at least 2 keys are available
        if (relevantKeys.length < 2) {
          console.log(`Skipping question ${question._id} - not enough guardian keys`);
          continue;
        }
        console.log("relevant keys", relevantKeys)
        const originalKey = EncryptionService.combineKeyShares(relevantKeys);

        console.log("decrypting question with key", originalKey)
        const decryptedQuestion = EncryptionService.decrypt(
          question.encryptedData.question,
          originalKey
        );
        console.log("decrypting options", decryptedQuestion)
        const decryptedOptions = question.encryptedData.options.map(opt => 
          EncryptionService.decrypt(opt, originalKey)
        );

        const decryptedCorrectOption = EncryptionService.decrypt(
          question.encryptedData.correctOption,
          originalKey
        );
        console.log("decrypted correct option")

        decodedQuestions.push({
          questionId: question._id,
          question: decryptedQuestion,
          options: decryptedOptions,
          correctOption: decryptedCorrectOption,
          isDecoded: true
        });
        console.log("decoded question")

      } catch (error) {
        console.error(`Error decoding question ${question._id}:`, error);
        continue;
      }
    }
    console.log("decoded questions")
    if (decodedQuestions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No questions could be decoded. Please try again.'
      });
    }

    exam.decodedQuestions = decodedQuestions;
    await exam.save();
    console.log(decodedQuestions)
    res.json({
      success: true,
      message: `Successfully decoded ${decodedQuestions.length} questions`,
      examDetails: {
        date: exam.date,
        startTime: exam.startTime,
        endTime: exam.endTime,
        status: exam.status,
        questions: decodedQuestions.map(q => ({
          id: q.questionId,
          question: q.question,
          options: q.options
        }))
      }
    });

  } catch (error) {
    console.log('Request paper error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing paper request'
    });
  }
};
