import mongoose, { Schema, model, models } from 'mongoose';

export interface IUser {
  id: string;
  name: string;
  role: 'planner' | 'driver';
  language: 'th' | 'en' | 'cn' | 'mm';
}

const UserSchema = new Schema<IUser>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: {
    type: String,
    enum: ['planner', 'driver'],
    required: true
  },
  language: {
    type: String,
    enum: ['th', 'en', 'cn', 'mm'],
    default: 'th'
  },
}, { timestamps: true });

export default models.User || model<IUser>('User', UserSchema);
