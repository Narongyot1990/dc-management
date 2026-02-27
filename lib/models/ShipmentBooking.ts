import mongoose, { Schema, Document } from 'mongoose';

export interface IShipmentBookingDoc extends Document {
  pickup_date: string;
  destination_branch: string;
  pickup_time: string;
  truck_plate_head: string;
  dock_number: string;      // เลขช่องโหลด
  clock_in: string;         // เวลาเข้าช่องโหลด (legacy)
  loading_start: string;    // เริ่มโหลด
  loading_end: string;      // เวลาออกจาก DC
  arrival_branch: string;   // เวลาถึงสาขา
  departure_branch: string; // เวลาออกจากสาขา
  return_dc: string;        // เวลากลับถึง DC
  status: 'draft' | 'fulfilled';
  matched_do_id: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const ShipmentBookingSchema = new Schema<IShipmentBookingDoc>(
  {
    pickup_date: { type: String, default: '' },
    destination_branch: { type: String, default: '' },
    pickup_time: { type: String, default: '' },
    truck_plate_head: { type: String, default: '' },
    dock_number: { type: String, default: '' },
    clock_in: { type: String, default: '' },
    loading_start: { type: String, default: '' },
    loading_end: { type: String, default: '' },
    arrival_branch: { type: String, default: '' },
    departure_branch: { type: String, default: '' },
    return_dc: { type: String, default: '' },
    status: {
      type: String,
      enum: ['draft', 'fulfilled'],
      default: 'draft',
    },
    matched_do_id: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

ShipmentBookingSchema.index({ pickup_date: 1 });
ShipmentBookingSchema.index({ destination_branch: 1 });
ShipmentBookingSchema.index({ status: 1 });
ShipmentBookingSchema.index({ truck_plate_head: 1 });

const ShipmentBooking =
  mongoose.models.ShipmentBooking ||
  mongoose.model<IShipmentBookingDoc>('ShipmentBooking', ShipmentBookingSchema);

export default ShipmentBooking;
