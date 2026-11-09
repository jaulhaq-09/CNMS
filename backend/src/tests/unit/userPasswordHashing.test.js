const mongoose = require('mongoose');
const User = require('../../models/User');
const { connectTestDB, clearTestDB, closeTestDB } = require('../testDb');

beforeAll(async () => {
    await connectTestDB();
});

afterEach(async () => {
    await clearTestDB();
});

afterAll(async () => {
    await closeTestDB();
});

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$/;

describe('User password hashing', () => {
    it('hashes the password on .create()', async () => {
        const user = await User.create({
            email: 'save.test@college.edu',
            password: 'PlainText123',
            firstName: 'Save',
            lastName: 'Test',
        });

        const stored = await User.findById(user._id).select('+password');
        expect(BCRYPT_HASH_PATTERN.test(stored.password)).toBe(true);
        expect(stored.password).not.toBe('PlainText123');
    });

    it('re-hashes correctly when the password is changed via .save()', async () => {
        const user = await User.create({
            email: 'resave.test@college.edu',
            password: 'FirstPassword1',
            firstName: 'Resave',
            lastName: 'Test',
        });

        const loaded = await User.findById(user._id).select('+password');
        loaded.password = 'SecondPassword2';
        await loaded.save();

        const reloaded = await User.findById(user._id).select('+password');
        expect(BCRYPT_HASH_PATTERN.test(reloaded.password)).toBe(true);

        const matchesOld = await reloaded.comparePassword('FirstPassword1');
        const matchesNew = await reloaded.comparePassword('SecondPassword2');
        expect(matchesOld).toBe(false);
        expect(matchesNew).toBe(true);
    });

    // Regression test: an admin script once used
    // User.findOneAndUpdate({ email }, { $set: { password: 'ChangeMe123!' } })
    // to set an initial password. findOneAndUpdate does NOT trigger
    // Mongoose's pre('save') hook, so the password was written to the DB
    // completely unhashed — every one of those accounts silently had a
    // plaintext password and could never log in, since comparePassword()
    // always runs bcrypt.compare() against what's assumed to be a hash.
    it('findOneAndUpdate does NOT hash the password (documents why it must never be used for password writes)', async () => {
        const user = await User.create({
            email: 'vulnerable.test@college.edu',
            password: 'InitialPass1',
            firstName: 'Vulnerable',
            lastName: 'Test',
        });

        await User.findOneAndUpdate(
            { _id: user._id },
            { $set: { password: 'PlainTextDanger1' } }
        );

        const stored = await User.findById(user._id).select('+password');

        // This assertion documents the bug, not a desired behavior — it
        // exists so that if a future Mongoose version or plugin changes this
        // behavior, this test fails loudly instead of the bug silently
        // reappearing in a maintenance script.
        expect(stored.password).toBe('PlainTextDanger1');
        expect(BCRYPT_HASH_PATTERN.test(stored.password)).toBe(false);
    });

    it('setting the same password value and calling markModified + save DOES re-hash it', async () => {
        const user = await User.create({
            email: 'markmodified.test@college.edu',
            password: 'SamePassword1',
            firstName: 'Mark',
            lastName: 'Modified',
        });

        const loaded = await User.findById(user._id).select('+password');
        const originalHash = loaded.password;

        loaded.password = 'SamePassword1'; // same plaintext value
        loaded.markModified('password');
        await loaded.save();

        const reloaded = await User.findById(user._id).select('+password');

        // The hash should have changed (bcrypt uses a random salt each time)
        // even though the plaintext input didn't.
        expect(reloaded.password).not.toBe(originalHash);
        expect(BCRYPT_HASH_PATTERN.test(reloaded.password)).toBe(true);

        const matches = await reloaded.comparePassword('SamePassword1');
        expect(matches).toBe(true);
    });

    it('comparePassword correctly rejects a wrong password', async () => {
        const user = await User.create({
            email: 'wrongpass.test@college.edu',
            password: 'CorrectPass1',
            firstName: 'Wrong',
            lastName: 'Pass',
        });

        const stored = await User.findById(user._id).select('+password');
        const matches = await stored.comparePassword('IncorrectPass1');
        expect(matches).toBe(false);
    });
});