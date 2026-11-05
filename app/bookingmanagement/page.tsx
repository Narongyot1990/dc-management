"use client";

import { useLanguage } from '@/contexts/LanguageContext';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Booking, BookingFormData, ScanResult, BookingStatus } from '@/types';
import { formatDateTime, getBangkokDateString } from '@/utils/format';
import { useBookingEvents } from '@/hooks/usePusher';
import { SearchInput, DateRangePicker, StatusFilterPills } from '@/components/ui';
import type { StatusPill } from '@/components/ui';
import {
  ClipboardList,
  Plus,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Camera,
  X,
  Edit3,
  Trash2,
  Link2,
  FileText,
} from 'lucide-react';

interface FormData extends BookingFormData {
  arrival_at: string;
}

const initialFormData: FormData = {
  booking_no: '',
  container_no: '',
  seal_no: '',
  vendor_name: '',
  truck_plate: '',
  arrival_at: '',
};

export default function BookingManagementPage() {
  const { t } = useLanguage();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<string>(getBangkokDateString(-7));
  const [endDate, setEndDate] = useState<string>(getBangkokDateString());

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showScanResultModal, setShowScanResultModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [deletingBooking, setDeletingBooking] = useState<Booking | null>(null);

  // Form state
  const [formData, setFormData] = useState<BookingFormData>(initialFormData);
  const [formLoading, setFormLoading] = useState(false);

  // Scan states
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Fetch bookings
  const fetchBookings = async () => {
    try {
      const response = await fetch('/api/bookings');
      const data = await response.json();
      if (data.success) {
        setBookings(data.data);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  // Listen for real-time booking events via Pusher
  useBookingEvents({
    onBookingCreated: useCallback(() => {
      fetchBookings();
    }, []),
    onBookingUpdated: useCallback(() => {
      fetchBookings();
    }, []),
  });

  // Check if date is in range
  const isInDateRange = (dateValue: string | Date | undefined) => {
    if (!dateValue) return false;
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    const start = new Date(startDate);
    const end = new Date(endDate);
    // Set time to start/end of day for comparison
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
  };

  // Calculate stats (filtered by date range)
  const stats = useMemo(() => {
    const dateFiltered = bookings.filter(b => isInDateRange(b.arrival_at || b.created_at));
    const pending = dateFiltered.filter(b => b.status === 'pending').length;
    const inProgress = dateFiltered.filter(b => b.status === 'in_progress').length;
    const completed = dateFiltered.filter(b => b.status === 'completed').length;
    const incomplete = dateFiltered.filter(b => b.status === 'incomplete').length;
    return { pending, inProgress, completed, incomplete, total: dateFiltered.length };
  }, [bookings, startDate, endDate]);

  // Filter bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter(booking => {
      // Date range filter
      if (!isInDateRange(booking.arrival_at || booking.created_at)) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'all' && booking.status !== statusFilter) {
        return false;
      }
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          booking.booking_no.toLowerCase().includes(query) ||
          booking.container_no.toLowerCase().includes(query) ||
          booking.vendor_name.toLowerCase().includes(query) ||
          booking.truck_plate.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [bookings, statusFilter, searchQuery, startDate, endDate]);

  // Get status badge
  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'pending':
        return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: t('status_pending') };
      case 'in_progress':
        return { bg: 'bg-blue-100', text: 'text-blue-700', label: t('status_in_progress') };
      case 'completed':
        return { bg: 'bg-green-100', text: 'text-green-700', label: t('status_completed') };
      case 'incomplete':
        return { bg: 'bg-orange-100', text: 'text-orange-700', label: t('status_incomplete') };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-700', label: status };
    }
  };

  // Get border color
  const getStatusBorderColor = (status: BookingStatus) => {
    switch (status) {
      case 'pending': return 'border-l-yellow-500';
      case 'in_progress': return 'border-l-blue-500';
      case 'completed': return 'border-l-green-500';
      case 'incomplete': return 'border-l-orange-500';
      default: return 'border-l-gray-300';
    }
  };

  // Format date for input
  const formatDateForInput = (dateValue?: string | Date) => {
    if (!dateValue) return '';
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    return date.toISOString().slice(0, 16);
  };

  const getBangkokNow = () => {
    const now = new Date();
    const bangkokStr = now.toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' });
    // sv-SE locale gives "YYYY-MM-DD HH:mm:ss" format
    return bangkokStr.replace(' ', 'T').slice(0, 16);
  };

  const handleTodayClick = () => {
    const bangkokNow = getBangkokNow();
    const dateStr = bangkokNow.slice(0, 10);
    const currentTime = formData.arrival_at ? formData.arrival_at.slice(11, 16) : '';
    setFormData({ ...formData, arrival_at: `${dateStr}T${currentTime || '00:00'}` });
  };

  const handleNowClick = () => {
    setFormData({ ...formData, arrival_at: getBangkokNow() });
  };

  const handleAddClick = () => {
    setFormData(initialFormData);
    setEditingBooking(null);
    setShowAddModal(true);
  };

  const handleEditClick = (booking: Booking) => {
    setFormData({
      booking_no: booking.booking_no,
      container_no: booking.container_no,
      seal_no: booking.seal_no,
      vendor_name: booking.vendor_name,
      truck_plate: booking.truck_plate,
      arrival_at: formatDateForInput(booking.arrival_at),
    });
    setEditingBooking(booking);
    setShowAddModal(true);
  };

  const handleDeleteClick = (booking: Booking) => {
    setDeletingBooking(booking);
    setShowDeleteModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.booking_no || !formData.container_no || !formData.seal_no ||
        !formData.vendor_name || !formData.truck_plate) {
      alert('Please fill all required fields');
      return;
    }

    setFormLoading(true);
    try {
      const url = editingBooking ? `/api/bookings/${editingBooking.id}` : '/api/bookings';
      const method = editingBooking ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          arrival_at: formData.arrival_at ? new Date(formData.arrival_at).toISOString() : undefined,
        }),
      });

      if (response.ok) {
        setShowAddModal(false);
        fetchBookings();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving booking:', error);
      alert('Failed to save booking');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingBooking) return;

    setFormLoading(true);
    try {
      const response = await fetch(`/api/bookings/${deletingBooking.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setShowDeleteModal(false);
        setDeletingBooking(null);
        fetchBookings();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting booking:', error);
      alert('Failed to delete booking');
    } finally {
      setFormLoading(false);
    }
  };

  // ============= SCAN LOGIC =============
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
    setScanProgress(0);
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      setIsScanning(true);
      setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.play();
        }
      }, 100);
    } catch (err) {
      console.error('Camera error:', err);
      alert(t('scanner_error_camera'));
    }
  };

  const performDocumentScan = async (canvas: HTMLCanvasElement): Promise<ScanResult | null> => {
    try {
      setScanProgress(10);
      const base64Image = canvas.toDataURL('image/jpeg', 0.95);
      setScanProgress(30);
      const response = await fetch('/api/booking-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image }),
      });
      setScanProgress(80);
      if (!response.ok) return null;
      const data = await response.json();
      setScanProgress(100);
      return data as ScanResult;
    } catch (err) {
      console.error('Scan error:', err);
      return null;
    } finally {
      setScanProgress(0);
    }
  };

  const handleCaptureScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setFormLoading(true);
    const result = await performDocumentScan(canvas);
    setFormLoading(false);
    if (result) {
      setScanResult(result);
      stopCamera();
      setShowScanModal(false);
      setShowScanResultModal(true);
    } else {
      alert(t('scanner_error_not_found'));
    }
  };

  const handleUseScanResult = () => {
    if (scanResult) {
      setFormData({
        ...formData,
        booking_no: scanResult.booking_no || formData.booking_no,
        container_no: scanResult.container_no || formData.container_no,
        seal_no: scanResult.seal_no || formData.seal_no,
        truck_plate: scanResult.truck_plate || formData.truck_plate,
      });
    }
    setShowScanResultModal(false);
    setScanResult(null);
    setShowAddModal(true);
  };

  const handleScanBack = () => {
    setShowScanResultModal(false);
    setScanResult(null);
  };

  useEffect(() => {
    return () => { stopCamera(); };
  }, [stopCamera]);

  return (
    <div className="flex flex-col overflow-hidden bg-[var(--background)] h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-[var(--border)]">
        {/* Title Bar */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
          <h1 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            {t('booking_records')}
          </h1>
          <button
            onClick={handleAddClick}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('add')}
          </button>
        </div>

        {/* Filters Section */}
        <div className="px-3 py-2.5 space-y-2.5">
          {/* Search + Date Range */}
          <div className="flex items-center gap-2">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t('search_placeholder') || 'Search...'}
              ringColor="focus:ring-blue-500"
            />
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onReset={() => { setStartDate(getBangkokDateString(-7)); setEndDate(getBangkokDateString()); }}
            />
          </div>

          {/* Status Filter Pills */}
          <StatusFilterPills
            pills={[
              { key: 'all', count: stats.total, icon: Layers, label: t('all'), bgActive: 'bg-gray-700', bgInactive: 'bg-gray-100', textInactive: 'text-gray-600' },
              { key: 'pending', count: stats.pending, icon: Clock, label: t('status_pending'), bgActive: 'bg-amber-500', bgInactive: 'bg-amber-50', textInactive: 'text-amber-700' },
              { key: 'in_progress', count: stats.inProgress, icon: Loader2, label: t('status_in_progress'), bgActive: 'bg-blue-500', bgInactive: 'bg-blue-50', textInactive: 'text-blue-700' },
              { key: 'completed', count: stats.completed, icon: CheckCircle2, label: t('status_completed'), bgActive: 'bg-emerald-500', bgInactive: 'bg-emerald-50', textInactive: 'text-emerald-700' },
              { key: 'incomplete', count: stats.incomplete, icon: AlertTriangle, label: t('status_incomplete'), bgActive: 'bg-orange-500', bgInactive: 'bg-orange-50', textInactive: 'text-orange-700' },
            ]}
            activeKey={statusFilter}
            onSelect={(key) => setStatusFilter(key as BookingStatus | 'all')}
          />
        </div>
      </div>

      {/* Booking List */}
      <div className="flex-1 px-3 py-2 overflow-hidden min-h-0">
        <div className="bg-white rounded-lg shadow-sm h-full flex flex-col border border-gray-200">
          <div className="px-3 py-1.5 border-b border-gray-100 shrink-0 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {t('search_placeholder')?.replace('...', '')}: <span className="font-medium text-gray-700">{filteredBookings.length}</span> / {stats.total}
            </span>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-xs">
              {searchQuery ? t('no_results') : t('no_bookings')}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {filteredBookings.map((booking) => {
                const statusBadge = getStatusBadge(booking.status);
                return (
                  <div key={booking.id} className={`border-l-[3px] ${getStatusBorderColor(booking.status)}`}>
                    <button
                      onClick={() => setExpandedId(expandedId === booking.id ? null : booking.id)}
                      className="w-full px-2.5 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {expandedId === booking.id ? (
                          <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1 text-left">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-xs text-[var(--text-primary)] truncate">
                              {booking.booking_no}
                            </span>
                            <span className={`text-[8px] px-1.5 py-0.5 rounded ${statusBadge.bg} ${statusBadge.text}`}>
                              {statusBadge.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                              {booking.container_no}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)]">•</span>
                            <span className="text-[10px] text-[var(--text-muted)] truncate">
                              {booking.vendor_name}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="text-[9px] text-[var(--text-muted)] whitespace-nowrap ml-1">
                        {formatDateTime(booking.arrival_at || booking.created_at)}
                      </span>
                    </button>

                    {expandedId === booking.id && (
                      <div className="px-2.5 pb-2.5 pt-1 bg-gray-50 space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[var(--text-muted)] text-[10px]">{t('container_no')}:</span>
                            <p className="font-mono text-[var(--text-primary)]">{booking.container_no}</p>
                          </div>
                          <div>
                            <span className="text-[var(--text-muted)] text-[10px]">{t('seal_no')}:</span>
                            <p className="text-[var(--text-primary)]">{booking.seal_no}</p>
                          </div>
                          <div>
                            <span className="text-[var(--text-muted)] text-[10px]">{t('vendor_name')}:</span>
                            <p className="text-[var(--text-primary)]">{booking.vendor_name}</p>
                          </div>
                          <div>
                            <span className="text-[var(--text-muted)] text-[10px]">{t('truck_plate')}:</span>
                            <p className="text-[var(--text-primary)]">{booking.truck_plate}</p>
                          </div>
                        </div>

                        {booking.job_id && (
                          <div className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded flex items-center gap-1">
                            <Link2 className="w-3 h-3" />
                            {t('linked_job')}: {booking.job_id}
                          </div>
                        )}

                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleEditClick(booking)}
                            className="flex-1 py-1.5 px-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-[10px] rounded-lg transition-colors flex items-center justify-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            {t('edit')}
                          </button>
                          <button
                            onClick={() => handleDeleteClick(booking)}
                            className="flex-1 py-1.5 px-2 bg-red-100 hover:bg-red-200 text-red-700 text-[10px] rounded-lg transition-colors flex items-center justify-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            {t('delete')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-3 border-b sticky top-0 bg-white">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                {editingBooking ? t('edit_booking') : t('new_booking')}
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { setShowAddModal(false); setShowScanModal(true); }}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title={t('scan_document')}
                >
                  <Camera className="w-4 h-4" />
                </button>
                <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-2.5 space-y-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">{t('booking_no')} *</label>
                <input
                  type="text"
                  value={formData.booking_no}
                  onChange={(e) => setFormData({ ...formData, booking_no: e.target.value })}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="BK-2026-001"
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">{t('container_no')} *</label>
                <input
                  type="text"
                  value={formData.container_no}
                  onChange={(e) => setFormData({ ...formData, container_no: e.target.value.toUpperCase() })}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="TCLU1234567"
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">{t('seal_no')} *</label>
                <input
                  type="text"
                  value={formData.seal_no}
                  onChange={(e) => setFormData({ ...formData, seal_no: e.target.value })}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="SL-12345"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-0.5">{t('vendor_name')} *</label>
                  <input
                    type="text"
                    value={formData.vendor_name}
                    onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="ABC Logistics"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-0.5">{t('truck_plate')} *</label>
                  <input
                    type="text"
                    value={formData.truck_plate}
                    onChange={(e) => setFormData({ ...formData, truck_plate: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="กข-1234"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">{t('arrival')}</label>
                <input
                  type="datetime-local"
                  value={formData.arrival_at}
                  onChange={(e) => setFormData({ ...formData, arrival_at: e.target.value })}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="flex gap-1.5 mt-1">
                  <button type="button" onClick={handleTodayClick} className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] rounded">
                    {t('today_btn')}
                  </button>
                  <button type="button" onClick={handleNowClick} className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] rounded">
                    {t('now_btn')}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 p-2.5 border-t sticky bottom-0 bg-white">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded text-xs">
                {t('cancel')}
              </button>
              <button onClick={handleSubmit} disabled={formLoading} className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded text-xs">
                {formLoading ? '...' : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scan Modal */}
      {showScanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-2.5 border-b">
              <h3 className="text-sm font-semibold text-gray-800">{t('scan_document')}</h3>
              <button onClick={() => { stopCamera(); setShowScanModal(false); setShowAddModal(true); }} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>

            {isScanning ? (
              <div className="relative">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-48 object-cover bg-black" />
                <canvas ref={canvasRef} className="hidden" />
                {formLoading && (
                  <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
                    <div className="text-center text-white">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-1"></div>
                      <p className="text-xs">{t('scanner_processing')}</p>
                      {scanProgress > 0 && <p className="text-[10px]">{scanProgress}%</p>}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 text-center">
                <div className="text-3xl mb-2">📄</div>
                <p className="text-gray-700 text-xs">{t('scan_document')}</p>
                <p className="text-gray-500 text-[10px]">{t('scan_document_desc')}</p>
              </div>
            )}

            <div className="p-2.5 space-y-1.5">
              {!isScanning ? (
                <button onClick={startCamera} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded text-xs">
                  📷 {t('scanner_open_camera')}
                </button>
              ) : (
                <button onClick={handleCaptureScan} disabled={formLoading} className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-medium rounded text-xs">
                  {formLoading ? t('scanner_processing') : `📸 ${t('scanner_capture_scan')}`}
                </button>
              )}
              <button onClick={() => { stopCamera(); setShowScanModal(false); setShowAddModal(true); }} className="w-full py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded text-xs">
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scan Result Modal */}
      {showScanResultModal && scanResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xs">
            <div className="p-3 text-center border-b">
              <div className="text-2xl mb-1">{scanResult.missing_fields.length === 0 ? '✅' : '⚠️'}</div>
              <h3 className="text-sm font-semibold text-gray-800">
                {scanResult.missing_fields.length === 0 ? t('scan_complete') : t('scan_incomplete')}
              </h3>
            </div>
            <div className="p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">{t('booking_no')}:</span>
                <span className={scanResult.booking_no ? 'text-green-600' : 'text-red-500'}>
                  {scanResult.booking_no || t('not_found')} {scanResult.booking_no ? '✅' : '❌'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('container_no')}:</span>
                <span className={`font-mono ${scanResult.container_no ? 'text-green-600' : 'text-red-500'}`}>
                  {scanResult.container_no || t('not_found')} {scanResult.container_no ? '✅' : '❌'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('seal_no')}:</span>
                <span className={scanResult.seal_no ? 'text-green-600' : 'text-red-500'}>
                  {scanResult.seal_no || t('not_found')} {scanResult.seal_no ? '✅' : '❌'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('truck_plate')}:</span>
                <span className={scanResult.truck_plate ? 'text-green-600' : 'text-red-500'}>
                  {scanResult.truck_plate || t('not_found')} {scanResult.truck_plate ? '✅' : '❌'}
                </span>
              </div>
            </div>
            <div className="p-2 border-t flex gap-1.5">
              <button onClick={handleScanBack} className="flex-1 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded text-[10px]">
                ← {t('back')}
              </button>
              <button onClick={() => { setShowScanResultModal(false); setScanResult(null); setShowScanModal(true); }} className="flex-1 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded text-[10px]">
                ↻ {t('btn_redo')}
              </button>
              <button onClick={handleUseScanResult} className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded text-[10px]">
                ✓ {t('btn_ok')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && deletingBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xs">
            <div className="p-4 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{t('confirm_delete')}</h3>
              <p className="text-[10px] text-[var(--text-muted)]">{t('confirm_delete_desc')}</p>
              <p className="font-medium text-[var(--text-primary)] text-xs mt-2">{deletingBooking.booking_no}</p>
            </div>
            <div className="flex gap-2 p-3 border-t">
              <button onClick={() => { setShowDeleteModal(false); setDeletingBooking(null); }} className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-xs">
                {t('cancel')}
              </button>
              <button onClick={handleDelete} disabled={formLoading} className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-1">
                <Trash2 className="w-3.5 h-3.5" />
                {formLoading ? '...' : t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
