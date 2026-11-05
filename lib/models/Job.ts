import mongoose, { Schema, model, models } from 'mongoose';

export interface IJob {
  id: string;
  type: 'in' | 'out' | 'swap';
  container_no: string;
  dock_from?: string;
  dock_to?: string;
  driver_id?: string;
  status: 'pending' | 'completed' | 'issue' | 'cancelled';
  priority?: number;
  purpose?: 'for_loading' | 'for_unloading'; // For container IN
  completion_status?: 'completed' | 'incomplete'; // For container OUT
  remark?: string;
  issue_type?: 'not_found' | 'wrong_number' | 'duplicate' | 'other';
  issue_detail?: string;
  created_at: Date;
  created_by: string;
  completed_at?: Date;
}

const JobSchema = new Schema<IJob>({
  id: { type: String, required: true, unique: true },
  type: { type: String, enum: ['in', 'out', 'swap'], required: true },
  container_no: { type: String, required: true },
  dock_from: { type: String },
  dock_to: { type: String },
  driver_id: { type: String },
  status: {
    type: String,
    enum: ['pending', 'completed', 'issue', 'cancelled'],
    default: 'pending'
  },
  priority: { type: Number, default: 0 },
  purpose: {
    type: String,
    enum: ['for_loading', 'for_unloading']
  },
  completion_status: {
    type: String,
    enum: ['completed', 'incomplete']
  },
  remark: { type: String },
  issue_type: {
    type: String,
    enum: ['not_found', 'wrong_number', 'duplicate', 'other']
  },
  issue_detail: { type: String },
  created_at: { type: Date, default: Date.now },
  created_by: { type: String, required: true },
  completed_at: { type: Date },
}, { timestamps: true });

if (process.env.NODE_ENV === 'development' && models.Job) {
  delete mongoose.models.Job;
}

export default models.Job || model<IJob>('Job', JobSchema);
