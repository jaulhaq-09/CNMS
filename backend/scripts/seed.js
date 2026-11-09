/**
 * Seeds one Super Admin + sample departments/users so you can log in
 * without manually inserting documents into MongoDB.
 *
 * Usage:  node scripts/seed.js
 *
 * Matches the REAL schema:
 *   - User.department is an ObjectId ref to Department
 *   - User.clusters / User.sections are STRING ARRAYS — a person can be
 *     assigned to more than one (e.g. a Faculty member teaching in both
 *     the AI cluster and the Data Science cluster).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Department = require('../src/models/Department');

const DEPARTMENTS = [
  { name: 'Computer Science & Engineering', code: 'CSE' },
  { name: 'Information Technology', code: 'IT' },
  { name: 'Electronics & Communication', code: 'ECE' },
  { name: 'Mechanical Engineering', code: 'MECH' },
];

const DEFAULT_PASSWORD = 'ChangeMe123!';

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB:', mongoose.connection.name);

  const departmentDocs = {};
  for (const dept of DEPARTMENTS) {
    const doc = await Department.findOneAndUpdate(
      { code: dept.code },
      { $setOnInsert: dept },
      { upsert: true, new: true }
    );
    departmentDocs[dept.code] = doc;
    console.log(`Department ready: ${doc.name} (${doc.code})`);
  }

  const existingAdmin = await User.findOne({ email: 'admin@cnms.edu' });
  if (!existingAdmin) {
    await User.create({
      firstName: 'System',
      lastName: 'Admin',
      email: 'admin@cnms.edu',
      password: DEFAULT_PASSWORD,
      role: 'SUPER_ADMIN',
      isActive: true,
      emailVerified: true,
    });
    console.log('Created Super Admin: admin@cnms.edu');
  } else {
    console.log('Super Admin already exists, skipping.');
  }

  const cse = departmentDocs.CSE;

  const sampleUsers = [
    {
      firstName: 'Coordinator',
      lastName: 'AI Cluster',
      email: 'coordinator.ai@cnms.edu',
      role: 'COORDINATOR',
      department: cse._id,
      clusters: ['AI'],
    },
    // Demonstrates a teacher assigned to MULTIPLE clusters/sections —
    // e.g. teaches in both the AI cluster and the Data Science cluster.
    {
      firstName: 'Faculty',
      lastName: 'Member',
      email: 'faculty.ai@cnms.edu',
      role: 'FACULTY',
      department: cse._id,
      clusters: ['AI', 'Data Science'],
      sections: ['Section A', 'Section B'],
    },
  ];

  for (const u of sampleUsers) {
    const existing = await User.findOne({ email: u.email });
    await User.findOneAndUpdate(
        { email: u.email },
        {
        $set: { ...u, isActive: true, emailVerified: true },
        $setOnInsert: { password: DEFAULT_PASSWORD },
        },
        { upsert: true, new: true }
    );
    console.log(existing ? `Synced: ${u.email}` : `Created ${u.role}: ${u.email}`);
    }

  console.log('\nSeed complete. All sample accounts use the password:', DEFAULT_PASSWORD);
  console.log('Change this immediately if this ever touches a real environment.');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});