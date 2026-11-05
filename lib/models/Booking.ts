import mongoose, { Schema, model, models } from 'mongoose';

export interface IBooking {
  id: string;
  booking_no: string;
  container_no: string;
  seal_no: string;
  vendor_name: string;
  truck_plate: string;
  arrival_at?: Date;
  job_id?: string; // Link to Job for dock movement tracking
  status: 'pending' | 'in_progress' | 'completed' | 'incomplete';
  created_at: Date;
  updated_at?: Date;
}

const BookingSchema = new Schema<IBooking>({
  id: { type: String, required: true, unique: true },
  booking_no: { type: String, required: true },
  container_no: { type: String, required: true },
  seal_no: { type: String, required: true },
  vendor_name: { type: String, required: true },
  truck_plate: { type: String, required: true },
  arrival_at: { type: Date },
  job_id: { type: String }, // Link to Job (J001, J002, etc.)
  status: { type: String, enum: ['pending', 'in_progress', 'completed', 'incomplete'], default: 'pending' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date },
}, { timestamps: true });

export default models.Booking || model<IBooking>('Booking', BookingSchema);
