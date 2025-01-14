const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(
      "mongodb+srv://ganeshghatti6:MXWAcXoYvCYvGGSd@safepaper.8x5px.mongodb.net/safepaper?retryWrites=true&w=majority&appName=SafePaper"
    );
    console.log("MongoDB Connected Successfully");
  } catch (error) {
    console.error("MongoDB Connection Error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
