require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB:', mongoose.connection.name);

    const user = await User.findOne({ email: 'coordinator.ai@cnms.edu' });
    if (!user) {
        console.log('coordinator.ai@cnms.edu not found');
    } else {
        console.log({
            email: user.email,
            loginAttempts: user.loginAttempts,
            lockUntil: user.lockUntil,
            isLocked: user.isLocked,
            isActive: user.isActive,
        });
    }

    await mongoose.disconnect();
    process.exit(0);
}

run().catch((err) => {
    console.error('Check failed:', err);
    process.exit(1);
});