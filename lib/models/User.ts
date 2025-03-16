import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  userId: string;
  nickname: string;
  color?: string;
  lastActivity: Date;
  isOnline: boolean;
}

const UserSchema: Schema = new Schema({
  userId: { type: String, required: true, unique: true },
  nickname: { type: String, required: true },
  color: { type: String, default: '#000000' },
  lastActivity: { type: Date, default: Date.now },
  isOnline: { type: Boolean, default: false }
});

// mongoose.models가 정의되지 않았을 때만 모델 생성
export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema); 