export type DOStatus = 'pending' | 'verified' | 'rejected';

export interface IDeliveryOrder {
  _id: string;
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
  status: DOStatus;
  trip_no: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScanResult {
  dc_number: string | null;
  document_date: string | null;
  document_time: string | null;
  delivery_date: string | null;
  delivery_time: string | null;
  return_date: string | null;
  return_time: string | null;
  driver_name: string | null;
  driver_name_2: string | null;
  driver_phone: string | null;
  truck_plate_head: string | null;
  truck_plate_tail: string | null;
  vehicle_type: string | null;
  destination_branch: string | null;
  destination_address: string | null;
  confidence: 'high' | 'medium' | 'low';
  missing_fields: string[];
}

export interface DOFilter {
  search: string;
  date_from: string;
  date_to: string;
  destination_branch: string;
  missing_trip_no: boolean;
}

export interface IShipmentBooking {
  _id: string;
  pickup_date: string;
  destination_branch: string;
  pickup_time: string;
  truck_plate_head: string;
  dock_number: string;
  clock_in: string;
  loading_start: string;
  loading_end: string;
  arrival_branch: string;
  departure_branch: string;
  return_dc: string;
  status: 'draft' | 'fulfilled';
  matched_do_id?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  total?: number;
}
