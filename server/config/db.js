const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅  MongoDB connected');
  } catch (err) {
    console.error('⚠️  MongoDB connection failed:', err.message);
    console.error('    Server will continue running — Redis features are still available.');
    console.error('    Set MONGO_URI in .env to a valid MongoDB connection string.');
  }
};

module.exports = connectDB;