const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri || mongoUri.trim() === '') {
    throw new Error('FATAL: MONGO_URI environment variable is missing. A valid MongoDB connection string is required.');
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`[VitaLink DB] MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[VitaLink DB] Connection Error: ${error.message}`);
    throw error;
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('[VitaLink DB] Disconnected from MongoDB.');
  } catch (err) {
    console.error(`[VitaLink DB] Disconnect error: ${err.message}`);
  }
};

module.exports = { connectDB, disconnectDB };
