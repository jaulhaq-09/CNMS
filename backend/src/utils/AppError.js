// A lightweight custom error that carries an HTTP status code.
// Throw this instead of plain `new Error(...)` anywhere the caller
// needs to distinguish "bad request" from "not found" from "server broke".
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // marks "expected" errors vs real bugs
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;