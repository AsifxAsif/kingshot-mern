import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
	{
		username: {
			type: String,
			required: true,
			trim: true,
			minlength: 3,
			// Not unique — multiple accounts may share a display username
		},
		email: {
			type: String,
			required: true,
			unique: true,
			trim: true,
			lowercase: true,
		},
		passwordHash: {
			type: String,
			required: true,
		},
		gameId: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
	},
	{
		timestamps: true,
		collection: 'users',
	}
);

userSchema.methods.comparePassword = function (plain) {
	return bcrypt.compare(plain, this.passwordHash);
};

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
export { User };
