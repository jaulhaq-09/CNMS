require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function run() {
    console.log('Using MONGODB_URI:', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB:', mongoose.connection.name);

    const user = await User.findOne({ email: 'coordinator.ai@cnms.edu' }).select('+password');
    if (!user) {
        console.log('User not found');
    } else {
        console.log('Raw password field:', JSON.stringify(user.password));
        console.log('Length:', user.password?.length);
        console.log('Looks like a bcrypt hash:', /^\$2[aby]\$\d{2}\$/.test(user.password || ''));
    }

    await mongoose.disconnect();
    process.exit(0);
}

run().catch((err) => {
    console.error('Inspect failed:', err);
    process.exit(1);
});