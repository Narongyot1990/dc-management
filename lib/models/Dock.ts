import mongoose, { Schema, model, models } from 'mongoose';

export interface IDock {
  dock_id: string;
  status: 'available' | 'occupied';
  container_no?: string;
  job_id?: string;
  updated_at: Date;
}

const DockSchema = new Schema<IDock>({
  dock_id: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ['available', 'occupied'],
    default: 'available'
  },
  container_no: { type: String },
  job_id: { type: String },
  updated_at: { type: Date, default: Date.now },
}, { timestamps: true });

export default models.Dock || model<IDock>('Dock', DockSchema);
