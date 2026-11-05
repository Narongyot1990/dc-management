import { Schema, model, models } from 'mongoose';

export interface IYardCheck {
  id: string;
  type: 'empty' | 'laden' | 'chassis';
  container_no: string | null;
  size: '20GP' | '40GP' | '40HC' | null;
  chassis_plate: string;
  seal_no?: string;
  yard: string;
  yard_status: 'in' | 'out';
  inspection_status: 'pending' | 'passed' | null;
  checklist?: Array<{
    item: 1 | 2 | 3 | 4 | 5;
    result: 'pass' | 'fail' | null;
  }>;
  ng_detail?: string;
  checked_at: Date;
  checked_by: string;
  updated_at?: Date;
  remark?: string;
  history?: Array<{
    action: 'create' | 'update' | 'out' | 'inspect';
    at: Date;
    changes?: string;
  }>;
}

const YardCheckSchema = new Schema<IYardCheck>({
  id: { type: String, required: true, unique: true },
  type: {
    type: String,
    enum: ['empty', 'laden', 'chassis'],
    required: true,
  },
  container_no: { type: String, default: null, index: true },
  size: {
    type: String,
    enum: ['20GP', '40GP', '40HC'],
    default: null,
  },
  chassis_plate: { type: String, required: true, index: true },
  seal_no: { type: String },
  yard: { type: String, required: true, default: 'YZZ' },
  yard_status: {
    type: String,
    enum: ['in', 'out'],
    required: true,
    default: 'in',
  },
  inspection_status: {
    type: String,
    enum: ['pending', 'passed'],
    default: null,
  },
  checklist: [{
    item: { type: Number, enum: [1, 2, 3, 4, 5] },
    result: { type: String, enum: ['pass', 'fail', null], default: null },
  }],
  ng_detail: { type: String },
  checked_at: { type: Date, default: Date.now },
  checked_by: { type: String, required: true },
  remark: { type: String },
  history: [{
    action: { type: String, enum: ['create', 'update', 'out', 'inspect'], required: true },
    at: { type: Date, default: Date.now },
    changes: { type: String },
  }],
}, { timestamps: true });

export default models.YardCheck || model<IYardCheck>('YardCheck', YardCheckSchema);
