const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Spins up a real, isolated in-memory MongoDB instance for tests — never
// touches the actual dev database. Call in beforeAll().
async function connectTestDB() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}

// Call in afterEach() to reset state between tests without tearing down
// the whole in-memory server (much faster than reconnecting every time).
async function clearTestDB() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

// Call in afterAll() to fully shut down.
async function closeTestDB() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongoServer) await mongoServer.stop();
}

module.exports = { connectTestDB, clearTestDB, closeTestDB };