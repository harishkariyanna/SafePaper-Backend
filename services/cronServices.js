const Exam = require("../models/Exam");
const Question = require("../models/Question");
const EncryptionService = require("../utils/encryption");

const startCronJobs = async () => {
  console.log("Starting exam cron jobs...");

  try {
    console.log("Running exam check cron job...");
    const now = new Date();

    const exams = await Exam.find({
      status: "scheduled",
      decodedQuestions: { $size: 0 },
    })
      .populate({
        path: "selectedQuestions",
        populate: { path: "guardians" },
      })
      .populate("guardianKeys.guardian");

    console.log(
      `Found ${exams.length} scheduled exams without decoded questions`
    );

    for (const exam of exams) {
      console.log(`Processing exam ID: ${exam._id}`);

      const examDate = new Date(exam.date);
      const [hours, minutes] = exam.startTime.split(":");
      examDate.setHours(parseInt(hours), parseInt(minutes));

      const timeDiff = (examDate - now) / (1000 * 60);
      console.log(`Time until exam start: ${timeDiff.toFixed(2)} minutes`);

      if (timeDiff <= 5 && timeDiff > 0) {
        console.log("Exam is within 5 minutes of start time");
        const decodedQuestions = [];

        // Process each question individually
        for (const question of exam.selectedQuestions) {
          try {
            console.log(`Processing question ID: ${question._id}`);

            // Get the specific guardians for this question
            const questionGuardianIds = question.guardians.map((g) =>
              g._id.toString()
            );
            console.log("Question guardian IDs:", questionGuardianIds);

            // Get submitted keys only from guardians associated with this question
            const relevantKeys = exam.guardianKeys
              .filter((gk) =>
                questionGuardianIds.includes(gk.guardian._id.toString())
              )
              .map((gk) => {
                console.log(`Using key from guardian: ${gk.guardian.email}`);
                return Buffer.from(gk.key, "hex");
              });

            // Check if we have all required keys for this question
            if (relevantKeys.length !== 3) {
              console.log(
                `Skipping question ${question._id} - missing guardian keys`
              );
              continue;
            }

            console.log(
              `Combining ${relevantKeys.length} guardian keys for question ${question._id}`
            );
            const originalKey =
              EncryptionService.combineKeyShares(relevantKeys);

            // Decrypt question data
            const decryptedQuestion = EncryptionService.decrypt(
              question.encryptedData.question,
              originalKey
            );
            console.log(`Decrypted question: ${decryptedQuestion}`);

            const decryptedOptions = question.encryptedData.options.map((opt) =>
              EncryptionService.decrypt(opt, originalKey)
            );
            console.log(`Decrypted options: ${decryptedOptions}`);

            const decryptedCorrectOption = EncryptionService.decrypt(
              question.encryptedData.correctOption,
              originalKey
            );
            console.log(`Decrypted correct option: ${decryptedCorrectOption}`);

            decodedQuestions.push({
              questionId: question._id,
              question: decryptedQuestion,
              options: decryptedOptions,
              correctOption: decryptedCorrectOption,
              isDecoded: true,
            });

            console.log(`Successfully decoded question ${question._id}`);
          } catch (error) {
            console.error(`Error decoding question ${question._id}:`, error);
            continue; // Skip this question and continue with the next
          }
        }

        if (decodedQuestions.length > 0) {
          console.log(
            `Successfully decoded ${decodedQuestions.length} questions`
          );
          exam.decodedQuestions = decodedQuestions;
          await exam.save();
          console.log("Saved decoded questions to exam");
        } else {
          console.log("No questions were successfully decoded");
        }
      }
    }
  } catch (error) {
    console.error("Cron job error:", error);
  }
};

module.exports = { startCronJobs };
