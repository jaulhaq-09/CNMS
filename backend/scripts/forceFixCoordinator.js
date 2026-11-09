require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB:', mongoose.connection.name);

    const user = await User.findOne({ email: 'coordinator.ai@cnms.edu' }).select('+password');
    if (!user) {
        console.log('User not found');
        process.exit(1);
    }

    console.log('Before:', JSON.stringify(user.password));

    user.password = 'ChangeMe123!';
    user.markModified('password'); // force it, regardless of any equality check
    await user.save();

    const reloaded = await User.findOne({ email: 'coordinator.ai@cnms.edu' }).select('+password');
    console.log('After:', JSON.stringify(reloaded.password));
    console.log('Looks like a bcrypt hash now:', /^\$2[aby]\$\d{2}\$/.test(reloaded.password || ''));

    const isMatch = await reloaded.comparePassword('ChangeMe123!');
    console.log('Password match result:', isMatch);

    await mongoose.disconnect();
    process.exit(0);
}

run().catch((err) => {
    console.error('Fix failed:', err);
    process.exit(1);
});