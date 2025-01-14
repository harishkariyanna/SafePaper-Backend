const Question = require('../models/Question');
const User = require('../models/User');
const EncryptionService = require('../utils/encryption');
const { sendKeyShare } = require('../utils/emailService');
const { v4: uuidv4 } = require('uuid');

// Get all guardians
exports.getAllGuardians = async (req, res) => {
  console.log('Fetching available guardians');
  try {
    // First get all guardians
    const allGuardians = await User.find(
      { role: 'guardian' },
      'name email'
    );
    console.log(`Found ${allGuardians.length} total guardians`);

    // Get guardians who are already assigned to pending questions
    const assignedGuardians = await Question.find(
      { status: 'pending' },
      'guardians'
    ).populate('guardians', '_id');

    // Create a Set of assigned guardian IDs for efficient lookup
    const assignedGuardianIds = new Set(
      assignedGuardians.flatMap(question => 
        question.guardians.map(guardian => 
          guardian._id.toString()
        )
      )
    );

    console.log('Assigned guardian IDs:', assignedGuardianIds);

    // Filter out guardians who are already assigned
    const availableGuardians = allGuardians.filter(guardian => 
      !assignedGuardianIds.has(guardian._id.toString())
    );

    console.log(`Found ${availableGuardians.length} available guardians`);

    // Check if the paper setter has already set questions
    const existingQuestion = await Question.findOne({ paperSetter: req.user._id });
    const hasSetQuestions = existingQuestion !== null;

    res.json({ 
      success: true, 
      data: availableGuardians, 
      hasSetQuestions,
      totalGuardians: allGuardians.length,
      availableGuardians: availableGuardians.length
    });

  } catch (error) {
    console.error('Error fetching available guardians:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching available guardians' 
    });
  }
};
// Create questions
exports.createQuestion = async (req, res) => {
  console.log('Starting question creation process');
  try {
    // Check if paper setter has already created questions
    const existingQuestion = await Question.findOne({ paperSetter: req.user._id });
    if (existingQuestion) {
      console.log('Paper setter already created questions');
      return res.status(400).json({
        success: false,
        message: 'You have already submitted questions'
      });
    }

    const { questions, guardianIds } = req.body;

    // Validate input
    if (!questions || !guardianIds || guardianIds.length !== 3) {
      console.log('Invalid input data');
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields and exactly 3 guardians'
      });
    }

    console.log('Generating encryption key and shares');
    const key = EncryptionService.generateKey();
    const keyShares = EncryptionService.generateKeyShares(key, 3, 2);

    // Drop existing indexes before creating new questions
    await Question.collection.dropIndexes();

    // Create questions using insertMany method
    const questionData = questions.map((question) => {
      const encryptedQuestion = EncryptionService.encrypt(question.question, key);
      const encryptedOptions = question.options.map(option => 
        EncryptionService.encrypt(option, key)
      );
      const encryptedCorrectOption = EncryptionService.encrypt(
        question.correctOption, 
        key
      );

      return {
        questionId: uuidv4(),
        paperSetter: req.user._id,
        guardians: guardianIds,
        encryptedData: {
          question: encryptedQuestion,
          options: encryptedOptions,
          correctOption: encryptedCorrectOption
        },
        status: 'pending'
      };
    });

    await Question.insertMany(questionData);
    console.log(`Questions created successfully`);

    // Send key shares to guardians
    console.log('Sending key shares to guardians');
    const guardians = await User.find({ _id: { $in: guardianIds } });
    
    for (let i = 0; i < guardians.length; i++) {
      await sendKeyShare(
        guardians[i].email,
        keyShares[i].toString('hex'),
        req.user.name
      );
    }

    res.status(201).json({
      success: true,
      message: 'Questions created and key shares sent to guardians'
    });

  } catch (error) {
    console.error('Error in createQuestion:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating questions'
    });
  }
};

exports.decryptQuestion = async (req, res) => {
  try {
    const { questionId, guardianShares } = req.body;

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Convert hex shares back to buffers
    const shares = guardianShares.map(share => Buffer.from(share, 'hex'));

    // Combine shares to get the original key
    const key = EncryptionService.combineKeyShares(shares);

    // Decrypt the question data
    const iv = Buffer.from(question.iv, 'hex');
    const decryptedData = EncryptionService.decrypt(
      question.encryptedData,
      key,
      iv
    );

    res.json({
      success: true,
      data: decryptedData
    });

  } catch (error) {
    console.error('Decrypt question error:', error);
    res.status(500).json({
      success: false,
      message: 'Error decrypting question'
    });
  }
};
