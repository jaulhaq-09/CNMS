require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

const DEFAULT_PASSWORD = 'ChangeMe123!';
const EMAILS_TO_FIX = ['dean.cse@cnms.edu', 'faculty.ai@cnms.edu'];

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB:', mongoose.connection.name);

    for (const email of EMAILS_TO_FIX) {
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            console.log(`Skipped (not found): ${email}`);
            continue;
        }

        console.log(`\n${email}`);
        console.log('Before:', JSON.stringify(user.password));

        user.password = DEFAULT_PASSWORD;
        user.markModified('password'); // force the hashing hook to actually run
        await user.save();

        const reloaded = await User.findOne({ email }).select('+password');
        const looksHashed = /^\$2[aby]\$\d{2}\$/.test(reloaded.password || '');
        const isMatch = await reloaded.comparePassword(DEFAULT_PASSWORD);

        console.log('After:', JSON.stringify(reloaded.password));
        console.log('Looks like a bcrypt hash:', looksHashed);
        console.log('Password match result:', isMatch);
    }

    await mongoose.disconnect();
    process.exit(0);
}

run().catch((err) => {
    console.error('Fix failed:', err);
    process.exit(1);
});