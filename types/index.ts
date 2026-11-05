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

// ----- Scan Result -----
export interface ScanResult {
  booking_no: string | null;
  container_no: string | null;
  seal_no: string | null;
  truck_plate: string | null;
  confidence: 'high' | 'medium' | 'low';
  missing_fields: string[];
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
