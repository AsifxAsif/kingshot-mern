import mongoose from 'mongoose';

let cached = globalThis.__kingshot_mongoose;
if (!cached) {
  cached = globalThis.__kingshot_mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set (check Vercel Environment Variables)');
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    mongoose.set('strictQuery', true);
    cached.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000,
        // Helps on some serverless / DNS environments
        family: 4,
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
