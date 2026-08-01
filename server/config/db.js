import mongoose from 'mongoose';

/**
 * Cached connection for Vercel serverless (reuse across warm invocations)
 */
let cached = globalThis.__kingshot_mongoose;
if (!cached) {
  cached = globalThis.__kingshot_mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
      })
      .then((mongooseInstance) => {
        console.log(`MongoDB connected: ${mongooseInstance.connection.host}`);
        return mongooseInstance;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error(`MongoDB connection error: ${e.message}`);
    throw e;
  }

  return cached.conn;
};

export default connectDB;
