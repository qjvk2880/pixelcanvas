import mongoose, { Schema, Document } from 'mongoose';

export interface IPixel extends Document {
  x: number;
  y: number;
  color: string;
  lastModified: Date;
}

const PixelSchema: Schema = new Schema({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  color: { type: String, required: true, default: '#FFFFFF' },
  lastModified: { type: Date, default: Date.now }
});

// x, y 좌표를 복합 인덱스로 설정 (고유한 위치 보장)
PixelSchema.index({ x: 1, y: 1 }, { unique: true });

// 모델이 이미 있으면 사용하고, 없으면 생성
export const Pixel = mongoose.models.Pixel || 
  mongoose.model<IPixel>('Pixel', PixelSchema); 