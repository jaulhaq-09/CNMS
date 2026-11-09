require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

const DEFAULT_PASSWORD = 'ChangeMe123!';
const EMAILS_TO_FIX = [
    'admin@cnms.edu',
    'dean.cse@cnms.edu',
    'coordinator.ai@cnms.edu',
    'faculty.ai@cnms.edu',
];

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB:', mongoose.connection.name);

    for (const email of EMAILS_TO_FIX) {
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            console.log(`Skipped (not found): ${email}`);
            continue;
        }
        // Setting .password and calling .save() runs the pre('save') hook,
        // which hashes it correctly this time.
        user.password = DEFAULT_PASSWORD;
        await user.save();
        console.log(`Password re-hashed: ${email}`);
    }

    await mongoose.disconnect();
    process.exit(0);
}

run().catch((err) => {
    console.error('Fix failed:', err);
    process.exit(1);
});