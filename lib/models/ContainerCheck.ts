import { Schema, model, models } from 'mongoose';

export interface IContainerCheck {
  id: string;
  container_no: string;
  vendor: 'FLS' | 'TMC' | 'NNR' | 'U-Globe' | 'Other';
  location: 'yard' | 'dock';
  dock_no: string | null;
  status: 'pending' | 'loading' | 'loaded' | 'departed';
  checked_at: Date;
  checked_by: string;
  updated_at?: Date;
  remark?: string;
  history?: Array<{
    action: 'create' | 'update' | 'departed';
    at: Date;
    changes?: string;
  }>;
}

const ContainerCheckSchema = new Schema<IContainerCheck>({
  id: { type: String, required: true, unique: true },
  container_no: { type: String, required: true, index: true },
  vendor: {
    type: String,
    enum: ['FLS', 'TMC', 'NNR', 'U-Globe', 'Other'],
    required: true
  },
  location: {
    type: String,
    enum: ['yard', 'dock'],
    required: true
  },
  dock_no: { type: String, default: null },
  status: {
    type: String,
    enum: ['pending', 'loading', 'loaded', 'departed'],
    required: true
  },
  checked_at: { type: Date, default: Date.now },
  checked_by: { type: String, required: true },
  remark: { type: String },
  history: [{
    action: { type: String, enum: ['create', 'update', 'departed'], required: true },
    at: { type: Date, default: Date.now },
    changes: { type: String },
  }],
}, { timestamps: true });

export default models.ContainerCheck || model<IContainerCheck>('ContainerCheck', ContainerCheckSchema);
