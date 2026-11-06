// =============================================
// Shared Types for Dock Management System
// =============================================

// ----- Status Types -----
export type BookingStatus = 'pending' | 'in_progress' | 'completed' | 'incomplete';
export type JobStatus = 'pending' | 'completed' | 'issue' | 'cancelled';
export type JobType = 'in' | 'out' | 'swap';
export type JobPurpose = 'for_loading' | 'for_unloading';
export type CompletionStatus = 'completed' | 'incomplete';
export type IssueType = 'not_found' | 'wrong_number' | 'duplicate' | 'other';
export type Language = 'th' | 'en' | 'cn' | 'mm';

// ----- Booking -----
export interface Booking {
  id: string;
  booking_no: string;
  container_no: string;
  seal_no: string;
  vendor_name: string;
  truck_plate: string;
  arrival_at?: string | Date;
  job_id?: string;
  status: BookingStatus;
  created_at: string | Date;
  updated_at?: string | Date;
}

export interface BookingFormData {
  booking_no: string;
  container_no: string;
  seal_no: string;
  vendor_name: string;
  truck_plate: string;
  arrival_at?: string;
}

// ----- Job -----
export interface Job {
  id: string;
  type: JobType;
  container_no: string;
  dock_from?: string;
  dock_to?: string;
  driver_id?: string;
  status: JobStatus;
  priority?: number;
  purpose?: JobPurpose;
  completion_status?: CompletionStatus;
  remark?: string;
  issue_type?: IssueType;
  issue_detail?: string;
  created_at: string | Date;
  created_by: string;
  completed_at?: string | Date;
}

export interface JobFormData {
  container_no: string;
  dock_from?: string;
  dock_to?: string;
  remark?: string;
  purpose?: JobPurpose;
  completion_status?: CompletionStatus;
}

// ----- Dock -----
export interface DockInfo {
  dock: string;
  containerNo: string;
  completedAt?: string;
}

export interface DockOccupancy {
  [dock: string]: {
    containerNo: string;
    completedAt?: string;
  };
}

// ----- Container Check -----
export type ContainerCheckVendor = 'FLS' | 'TMC' | 'NNR' | 'U-Globe' | 'Other';
export type ContainerCheckLocation = 'yard' | 'dock';
export type ContainerCheckStatus = 'pending' | 'loading' | 'loaded' | 'departed';

export interface ContainerCheckHistory {
  action: 'create' | 'update' | 'departed';
  at: string | Date;
  changes?: string;
}

export interface ContainerCheck {
  id: string;
  container_no: string;
  vendor: ContainerCheckVendor;
  location: ContainerCheckLocation;
  dock_no: string | null;
  status: ContainerCheckStatus;
  checked_at: string | Date;
  checked_by: string;
  updated_at?: string | Date;
  remark?: string;
  history?: ContainerCheckHistory[];
}

export interface ContainerCheckFormData {
  container_no: string;
  vendor: ContainerCheckVendor | '';
  location: ContainerCheckLocation | '';
  dock_no: string | null;
  status: ContainerCheckStatus | '';
  remark?: string;
}

// ----- Yard Check -----
export type YardCheckType = 'empty' | 'laden' | 'chassis';
export type YardCheckSize = '20GP' | '40GP' | '40HC';
export type YardCheckYardStatus = 'in' | 'out';
export type YardCheckInspectionStatus = 'pending' | 'passed';
export type YardCheckChecklistResult = 'pass' | 'fail' | null;

export interface YardCheckChecklistItem {
  item: 1 | 2 | 3 | 4 | 5;
  result: YardCheckChecklistResult;
}

export interface YardCheckHistory {
  action: 'create' | 'update' | 'out' | 'inspect';
  at: string | Date;
  changes?: string;
}

export interface YardCheck {
  id: string;
  type: YardCheckType;
  container_no: string | null;
  size: YardCheckSize | null;
  chassis_plate: string;
  seal_no?: string;
  yard: string;
  yard_status: YardCheckYardStatus;
  inspection_status: YardCheckInspectionStatus | null;
  checklist?: YardCheckChecklistItem[];
  ng_detail?: string;
  checked_at: string | Date;
  checked_by: string;
  updated_at?: string | Date;
  remark?: string;
  history?: YardCheckHistory[];
}

export interface YardCheckFormData {
  type: YardCheckType | '';
  container_no: string;
  size: YardCheckSize | '';
  chassis_plate: string;
  seal_no?: string;
  remark?: string;
}

// ----- Scan Result -----
export interface ScanResult {
  booking_no: string | null;
  container_no: string | null;
  seal_no: string | null;
  truck_plate: string | null;
  confidence: 'high' | 'medium' | 'low';
  missing_fields: string[];
}

// ----- Container Photo Scan (OCR) -----
export interface ContainerScanResult {
  containerNumber: string;
  /** Container length/height bucket derived from the ISO 6346 size-type code, e.g. "45G1" -> "40HC". Optional — filled only when confidently detected. */
  size?: YardCheckSize | null;
  /** Trailer/chassis registration plate read from the image (e.g. "74-7267"). Optional — filled only when confidently detected. */
  chassisPlate?: string | null;
}

// ----- API Response -----
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ----- User (future) -----
export interface User {
  id: string;
  name: string;
  role: 'driver' | 'planner' | 'admin';
  employee_id: string;
}
