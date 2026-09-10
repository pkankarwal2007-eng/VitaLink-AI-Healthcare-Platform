const path = require('path');
const dotenv = require('dotenv');

// Load root .env
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const { ROLES } = require('../config/constants');
const { connectDB, disconnectDB } = require('../config/db');

/**
 * Secure development-only admin account seed/setup mechanism.
 * Reads credentials strictly from environment variables without exposing them.
 */
const seedAdmin = async () => {
  const adminEmail = (process.env.ADMIN_EMAIL || 'kankarwalp2007@gmail.com').trim().toLowerCase();
  let adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || typeof adminPassword !== 'string' || adminPassword.trim().length === 0) {
    console.log('[Admin Setup] Notice: ADMIN_PASSWORD is not set in root .env.');
    console.log('[Admin Setup] Please configure ADMIN_PASSWORD in your root .env file and run setup again.');
    return { success: false, code: 'ADMIN_PASSWORD_NOT_CONFIGURED' };
  }

  adminPassword = adminPassword.trim();
  if ((adminPassword.startsWith('"') && adminPassword.endsWith('"')) ||
      (adminPassword.startsWith("'") && adminPassword.endsWith("'"))) {
    adminPassword = adminPassword.slice(1, -1).trim();
  }

  let localConnection = false;
  if (mongoose.connection.readyState !== 1) {
    await connectDB();
    localConnection = true;
  }

  try {
    let admin = await User.findOne({ email: adminEmail });

    if (admin) {
      // Update existing admin account without creating a duplicate
      admin.password = adminPassword; // Pre-save hook will hash using bcryptjs
      admin.role = ROLES.ADMIN;
      admin.isActive = true;
      admin.isEmailVerified = true;
      await admin.save();
      console.log('Admin account setup completed successfully.');
      return { success: true, action: 'updated', email: adminEmail };
    } else {
      // Create new admin account
      await User.create({
        fullName: 'System Administrator',
        email: adminEmail,
        phone: '9876543210',
        password: adminPassword, // Pre-save hook will hash using bcryptjs
        role: ROLES.ADMIN,
        isActive: true,
        isEmailVerified: true
      });
      console.log('Admin account setup completed successfully.');
      return { success: true, action: 'created', email: adminEmail };
    }
  } catch (error) {
    console.error('[Admin Setup Error]: Unable to complete admin account setup.');
    throw error;
  } finally {
    if (localConnection && require.main === module) {
      await disconnectDB();
    }
  }
};

if (require.main === module) {
  seedAdmin()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(() => {
      process.exit(1);
    });
}

module.exports = { seedAdmin };
