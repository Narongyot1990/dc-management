import mongoose, { Schema, Document } from 'mongoose';

export interface IDeliveryOrderDoc extends Document {
  dc_number: string;
  document_date: string;
  document_time: string;
  delivery_date: string;
  delivery_time: string;
  return_date: string;
  return_time: string;
  driver_name: string;
  driver_name_2: string;
  driver_phone: string;
  truck_plate_head: string;
  truck_plate_tail: string;
  vehicle_type: string;
  destination_branch: string;
  destination_address: string;
  scan_image: string;
  status: 'pending' | 'verified' | 'rejected';
  trip_no: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryOrderSchema = new Schema<IDeliveryOrderDoc>(
  {
    dc_number: { type: String, default: '' },
    document_date: { type: String, default: '' },
    document_time: { type: String, default: '' },
    delivery_date: { type: String, default: '' },
    delivery_time: { type: String, default: '' },
    return_date: { type: String, default: '' },
    return_time: { type: String, default: '' },
    driver_name: { type: String, default: '' },
    driver_name_2: { type: String, default: '' },
    driver_phone: { type: String, default: '' },
    truck_plate_head: { type: String, default: '' },
    truck_plate_tail: { type: String, default: '' },
    vehicle_type: { type: String, default: '' },
    destination_branch: { type: String, default: '' },
    destination_address: { type: String, default: '' },
    scan_image: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    trip_no: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

DeliveryOrderSchema.index({ dc_number: 1 });
DeliveryOrderSchema.index({ delivery_date: 1 });
DeliveryOrderSchema.index({ status: 1 });
DeliveryOrderSchema.index({ destination_branch: 1 });
DeliveryOrderSchema.index({ driver_name: 1 });
DeliveryOrderSchema.index({ truck_plate_head: 1 });
DeliveryOrderSchema.index({ trip_no: 1 });

const DeliveryOrder =
  mongoose.models.DeliveryOrder ||
  mongoose.model<IDeliveryOrderDoc>('DeliveryOrder', DeliveryOrderSchema);

export default DeliveryOrder;
