"use client";

import { useLanguage } from '@/contexts/LanguageContext';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ContainerScanner } from '@/components/scanner/ContainerScanner';
import type { Booking, JobType, JobFormData, ContainerScanResult } from '@/types';
import { formatDateTime } from '@/utils/format';
import { DOCKS } from '@/utils/constants';
import { useDockEvents, useBookingEvents, useJobEvents } from '@/hooks/usePusher';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  LayoutDashboard,
  X,
  ScanLine,
  Check,
  AlertTriangle,
  Package,
  Truck,
  CheckCircle2,
  CircleAlert,
  Link2
} from 'lucide-react';

// Local form data extends JobFormData
interface FormData extends JobFormData {
  container_no: string;
}

// Booking item for suggestions (subset of Booking)
type BookingItem = Pick<Booking, 'id' | 'booking_no' | 'container_no' | 'seal_no' | 'vendor_name' | 'truck_plate' | 'status'>;

interface OccupiedDockInfo {
  dock: string;
  containerNo: string;
}

export default function PlannerPage() {
  const { t } = useLanguage();
  const [selectedJobType, setSelectedJobType] = useState<JobType | null>(null);
  const [formData, setFormData] = useState<FormData>({
    container_no: '',
    dock_from: '',
    dock_to: '',
    remark: '',
    purpose: undefined,
    completion_status: undefined
  });
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // Dock conflict state
  const [occupiedDockInfo, setOccupiedDockInfo] = useState<OccupiedDockInfo | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);

  // Dock occupancy cache: dock -> { containerNo, completedAt }
  const [dockOccupancy, setDockOccupancy] = useState<Record<string, { containerNo: string; completedAt?: string }>>({});

  // Pending jobs cache by dock (to prevent double assignment)
  const [dockPending, setDockPending] = useState<Record<string, { containerNo: string; jobId: string; type: string }>>({});

  // Custom dock selector modal
  const [showDockSelector, setShowDockSelector] = useState(false);
  const [dockSelectorTarget, setDockSelectorTarget] = useState<'dock_to' | 'dock_from'>('dock_to');

  // Booking search states
  const [searchQuery, setSearchQuery] = useState('');
  const [allPendingBookings, setAllPendingBookings] = useState<BookingItem[]>([]);
  const [bookingSuggestions, setBookingSuggestions] = useState<BookingItem[]>([]);
  const [showBookingSuggestions, setShowBookingSuggestions] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingItem | null>(null);
  const [isSearchingBooking, setIsSearchingBooking] = useState(false);

  // Fetch all pending/incomplete bookings on mount
  const fetchAllPendingBookings = useCallback(async () => {
    setIsSearchingBooking(true);
    try {
      // Fetch both pending and incomplete bookings
      const [pendingRes, incompleteRes] = await Promise.all([
        fetch('/api/bookings?status=pending'),
        fetch('/api/bookings?status=incomplete')
      ]);
      const pendingData = await pendingRes.json();
      const incompleteData = await incompleteRes.json();

      const combined = [
        ...(pendingData.success ? pendingData.data : []),
        ...(incompleteData.success ? incompleteData.data : [])
      ];
      setAllPendingBookings(combined);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setIsSearchingBooking(false);
    }
  }, []);

  // Fetch pending/incomplete bookings on page mount (cache)
  useEffect(() => {
    fetchAllPendingBookings();
  }, [fetchAllPendingBookings]);

  // Filter bookings based on search query
  useEffect(() => {
    if (searchQuery.length === 0) {
      // Show all pending bookings when no search query
      setBookingSuggestions(allPendingBookings);
    } else {
      // Filter by search query (container_no, booking_no, vendor_name, truck_plate)
      const query = searchQuery.toLowerCase();
      const filtered = allPendingBookings.filter(b =>
        b.container_no.toLowerCase().includes(query) ||
        b.booking_no.toLowerCase().includes(query) ||
        b.vendor_name.toLowerCase().includes(query) ||
        b.truck_plate.toLowerCase().includes(query)
      );
      setBookingSuggestions(filtered);
    }
  }, [searchQuery, allPendingBookings]);

  // Clear form when job type changes
  useEffect(() => {
    setFormData({ container_no: '', dock_from: '', dock_to: '', remark: '', purpose: undefined, completion_status: undefined });
    setOccupiedDockInfo(null);
    setShowConflictModal(false);
    setSearchQuery('');
    setSelectedBooking(null);
    // bookingSuggestions will be set by filter effect based on searchQuery
  }, [selectedJobType]);

  // Fetch dock occupancy data
  const fetchDockOccupancy = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch('/api/jobs', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) return;

      const data = await response.json();
      const jobs = data.data || [];

      // Track pending jobs per dock (IN uses dock_to, OUT uses dock_from)
      const pendingDockMap: Record<string, { containerNo: string; jobId: string; type: string }> = {};
      jobs
        .filter((j: { status: string }) => j.status === 'pending')
        .forEach((j: { id: string; type: string; dock_to?: string; dock_from?: string; container_no: string; created_at: string }) => {
          const dock = j.type === 'in' ? j.dock_to : j.dock_from;
          if (!dock) return;

          const existing = pendingDockMap[dock];
          if (!existing) {
            pendingDockMap[dock] = { containerNo: j.container_no, jobId: j.id, type: j.type };
            return;
          }

          // If multiple pending jobs exist for same dock, keep the oldest (earliest created_at)
          const existingCreatedAt = (jobs.find((x: { id: string }) => x.id === existing.jobId) as { created_at?: string } | undefined)?.created_at;
          const existingTime = existingCreatedAt ? new Date(existingCreatedAt).getTime() : Number.POSITIVE_INFINITY;
          const thisTime = new Date(j.created_at).getTime();
          if (thisTime < existingTime) {
            pendingDockMap[dock] = { containerNo: j.container_no, jobId: j.id, type: j.type };
          }
        });

      // Calculate dock occupancy from completed jobs only
      // A dock is occupied if there's a completed IN and no completed OUT after it
      const completedJobs = jobs.filter((j: { status: string }) => j.status === 'completed');

      const inJobs = completedJobs
        .filter((j: { type: string; dock_to?: string }) => j.type === 'in' && j.dock_to)
        .sort((a: { completed_at?: string; created_at: string }, b: { completed_at?: string; created_at: string }) => {
          const bt = new Date(b.completed_at || b.created_at).getTime();
          const at = new Date(a.completed_at || a.created_at).getTime();
          return bt - at;
        });

      const outJobs = completedJobs
        .filter((j: { type: string; dock_from?: string }) => j.type === 'out' && j.dock_from)
        .sort((a: { completed_at?: string; created_at: string }, b: { completed_at?: string; created_at: string }) => {
          const bt = new Date(b.completed_at || b.created_at).getTime();
          const at = new Date(a.completed_at || a.created_at).getTime();
          return bt - at;
        });

      const occupancy: Record<string, { containerNo: string; completedAt?: string }> = {};
      DOCKS.forEach((dock) => {
        const latestIn = inJobs.find((j: { dock_to?: string }) => j.dock_to === dock);
        const latestOut = outJobs.find((j: { dock_from?: string }) => j.dock_from === dock);

        if (!latestIn) return;

        const inTime = new Date(latestIn.completed_at || latestIn.created_at).getTime();
        const outTime = latestOut ? new Date(latestOut.completed_at || latestOut.created_at).getTime() : 0;

        if (inTime > outTime) {
          occupancy[dock] = {
            containerNo: latestIn.container_no,
            completedAt: latestIn.completed_at,
          };
        }
      });

      setDockOccupancy(occupancy);
      setDockPending(pendingDockMap);
    } catch (error) {
      console.error('fetchDockOccupancy error:', error);
    }
  };

  // Fetch dock occupancy on mount
  useEffect(() => {
    fetchDockOccupancy();
  }, []);

  // Listen for real-time dock events via Pusher
  useDockEvents(useCallback((data: { dock: string; occupied: boolean; containerNo?: string }) => {
    setDockOccupancy(prev => {
      if (data.occupied && data.containerNo) {
        return { ...prev, [data.dock]: { containerNo: data.containerNo } };
      } else {
        const updated = { ...prev };
        delete updated[data.dock];
        return updated;
      }
    });
  }, []));

  // Listen for job events to refresh dock data
  useJobEvents({
    onJobCreated: useCallback(() => {
      fetchDockOccupancy();
    }, []),
    onJobUpdated: useCallback(() => {
      fetchDockOccupancy();
    }, []),
    onJobCompleted: useCallback(() => {
      fetchDockOccupancy();
    }, []),
  });

  // Listen for booking events to refresh cache
  useBookingEvents({
    onBookingCreated: useCallback(() => {
      fetchAllPendingBookings();
    }, [fetchAllPendingBookings]),
    onBookingUpdated: useCallback(() => {
      fetchAllPendingBookings();
    }, [fetchAllPendingBookings]),
  });

  // Check dock availability from cache (for IN jobs)
  useEffect(() => {
    if (selectedJobType !== 'in' || !formData.dock_to) {
      setOccupiedDockInfo(null);
      return;
    }

    // Use cache instead of API call
    const cachedInfo = dockOccupancy[formData.dock_to];
    if (cachedInfo && cachedInfo.containerNo !== formData.container_no) {
      setOccupiedDockInfo({
        dock: formData.dock_to,
        containerNo: cachedInfo.containerNo
      });
      setShowConflictModal(true);
    } else {
      setOccupiedDockInfo(null);
    }
  }, [selectedJobType, formData.dock_to, formData.container_no, dockOccupancy]);

  // Auto-fill container_no when selecting dock for OUT jobs (from cache)
  useEffect(() => {
    if (selectedJobType !== 'out' || !formData.dock_from) {
      return;
    }

    const cachedInfo = dockOccupancy[formData.dock_from];
    if (cachedInfo && !formData.container_no) {
      setFormData(prev => ({ ...prev, container_no: cachedInfo.containerNo }));
    }
  }, [selectedJobType, formData.dock_from, dockOccupancy]);

  // Handle move out - create OUT job for current container
  const handleMoveOut = async () => {
    if (!occupiedDockInfo) return;
    setLoading(true);

    try {
      const jobData = {
        type: 'out',
        container_no: occupiedDockInfo.containerNo,
        dock_from: occupiedDockInfo.dock,
        remark: 'Auto-created to move out existing container',
        created_by: 'PLN001',
        driver_id: 'DRV001'
      };

      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobData)
      });

      if (response.ok) {
        alert(`${t('container_out')} job created for ${occupiedDockInfo.containerNo}`);
        setShowConflictModal(false);
        setOccupiedDockInfo(null);
        // Keep the form data so user can continue with their IN job after OUT is done
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating move out job:', error);
      alert('Failed to create job');
    } finally {
      setLoading(false);
    }
  };

  // Handle clean - just clear the conflict and allow new job
  const handleClean = () => {
    setShowConflictModal(false);
    setOccupiedDockInfo(null);
    // User can now submit the new IN job
  };

  const handleScanComplete = ({ containerNumber }: ContainerScanResult) => {
    setFormData({ ...formData, container_no: containerNumber });
    setSearchQuery(containerNumber);
    setShowScanner(false);

    // Find matching booking from cache
    const matchedBooking = allPendingBookings.find(
      b => b.container_no.toLowerCase() === containerNumber.toLowerCase()
    );
    if (matchedBooking) {
      setSelectedBooking(matchedBooking);
      setFormData(prev => ({ ...prev, container_no: matchedBooking.container_no }));
    }
  };

  // Select booking from suggestions
  const handleSelectBooking = (booking: BookingItem) => {
    setSelectedBooking(booking);
    setFormData({ ...formData, container_no: booking.container_no });
    setSearchQuery(booking.container_no);
    setShowBookingSuggestions(false);
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const jobData = {
        type: selectedJobType,
        container_no: formData.container_no,
        dock_from: formData.dock_from,
        dock_to: formData.dock_to,
        remark: formData.remark,
        purpose: selectedJobType === 'in' ? formData.purpose : undefined,
        completion_status: selectedJobType === 'out' ? formData.completion_status : undefined,
        created_by: 'PLN001', // TODO: Get from auth
        driver_id: 'DRV001' // TODO: Assign to driver
      };

      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobData)
      });

      if (response.ok) {
        const jobResult = await response.json();

        // If booking was selected, update it with job_id and status
        if (selectedBooking && selectedJobType === 'in') {
          try {
            await fetch(`/api/bookings/${selectedBooking.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                job_id: jobResult.data.id,
                status: 'in_progress'
              })
            });
          } catch (err) {
            console.error('Error updating booking:', err);
          }
        }

        alert('Job created successfully!');
        // Reset form and job type
        setFormData({ container_no: '', dock_from: '', dock_to: '', remark: '', purpose: undefined, completion_status: undefined });
        setSelectedBooking(null);
        setSearchQuery('');
        setSelectedJobType(null);
        // Re-fetch bookings to update cache
        fetchAllPendingBookings();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating job:', error);
      alert('Failed to create job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:py-8 h-[calc(100vh-80px)] flex flex-col">
      <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-4 md:mb-6 tracking-tight shrink-0">{t('planner')}</h1>

      {!selectedJobType ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 shrink-0">
          {/* Container In */}
          <button
            onClick={() => setSelectedJobType('in')}
            className="bg-white border border-[var(--border)] hover:border-blue-300 p-5 md:p-6 rounded-xl shadow-sm hover:shadow-md transition-all min-h-[120px] md:min-h-[140px] flex flex-col items-center justify-center group"
          >
            <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
              <ArrowDownToLine className="w-6 h-6 md:w-7 md:h-7 text-blue-600" strokeWidth={1.75} />
            </div>
            <h2 className="text-sm md:text-base font-semibold text-[var(--text-primary)]">
              {t('container_in')}
            </h2>
          </button>

          {/* Container Out */}
          <button
            onClick={() => setSelectedJobType('out')}
            className="bg-white border border-[var(--border)] hover:border-emerald-300 p-5 md:p-6 rounded-xl shadow-sm hover:shadow-md transition-all min-h-[120px] md:min-h-[140px] flex flex-col items-center justify-center group"
          >
            <div className="w-12 h-12 md:w-14 md:h-14 bg-emerald-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-emerald-100 transition-colors">
              <ArrowUpFromLine className="w-6 h-6 md:w-7 md:h-7 text-emerald-600" strokeWidth={1.75} />
            </div>
            <h2 className="text-sm md:text-base font-semibold text-[var(--text-primary)]">
              {t('container_out')}
            </h2>
          </button>

          {/* Dashboard */}
          <Link href="/planner/dashboard">
            <button className="bg-white border border-[var(--border)] hover:border-violet-300 p-5 md:p-6 rounded-xl shadow-sm hover:shadow-md transition-all w-full min-h-[120px] md:min-h-[140px] flex flex-col items-center justify-center group">
              <div className="w-12 h-12 md:w-14 md:h-14 bg-violet-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-violet-100 transition-colors">
                <LayoutDashboard className="w-6 h-6 md:w-7 md:h-7 text-violet-600" strokeWidth={1.75} />
              </div>
              <h2 className="text-sm md:text-base font-semibold text-[var(--text-primary)]">
                {t('dashboard')}
              </h2>
            </button>
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[var(--border)] p-4 md:p-6 flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Form Header */}
          <div className="flex items-center justify-between mb-4 md:mb-6 shrink-0">
            <div className="flex items-center gap-2.5">
              {selectedJobType === 'in' && (
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <ArrowDownToLine className="w-4 h-4 text-blue-600" strokeWidth={2} />
                </div>
              )}
              {selectedJobType === 'out' && (
                <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <ArrowUpFromLine className="w-4 h-4 text-emerald-600" strokeWidth={2} />
                </div>
              )}
              <h2 className="text-base md:text-lg font-semibold text-[var(--text-primary)]">
                {selectedJobType === 'in' && t('container_in')}
                {selectedJobType === 'out' && t('container_out')}
              </h2>
            </div>
            <button
              onClick={() => setSelectedJobType(null)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-4 flex-1 overflow-y-auto min-h-0">
            {/* Container Number with Booking Search - Only for 'in' jobs */}
            {selectedJobType === 'in' && (
              <div className="relative">
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                  {t('container_no')}:
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setSearchQuery(val);
                        setFormData({ ...formData, container_no: val });
                        setShowBookingSuggestions(true);
                        if (val !== selectedBooking?.container_no) {
                          setSelectedBooking(null);
                        }
                      }}
                      onFocus={() => setShowBookingSuggestions(true)}
                      onBlur={() => {
                        // Delay hiding to allow click on suggestion
                        setTimeout(() => setShowBookingSuggestions(false), 200);
                      }}
                      className={`w-full border rounded-lg px-3 md:px-4 py-2 text-sm md:text-base text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono ${
                        selectedBooking ? 'border-green-500 bg-green-50' : 'border-gray-300'
                      }`}
                      placeholder={t('container_no_placeholder') || 'เลือกหรือพิมพ์ Container No...'}
                    />
                    {isSearchingBooking && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                      </div>
                    )}

                    {/* Booking Suggestions Dropdown */}
                    {showBookingSuggestions && bookingSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                        {bookingSuggestions.map((booking) => (
                          <button
                            key={booking.id}
                            onClick={() => handleSelectBooking(booking)}
                            className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-sm text-gray-900">{booking.container_no}</span>
                              <div className="flex items-center gap-1">
                                {booking.status === 'incomplete' && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded">
                                    {t('status_incomplete')}
                                  </span>
                                )}
                                <span className="text-xs text-gray-500">{booking.booking_no}</span>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {booking.vendor_name} • {booking.truck_plate}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setShowScanner(true)}
                    className="px-3 md:px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-xs md:text-sm flex items-center gap-1.5"
                  >
                    <ScanLine className="w-4 h-4" />
                    {t('scan_qr')}
                  </button>
                </div>

                {/* Selected Booking Info */}
                {selectedBooking && (
                  <div className="mt-2 p-2.5 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-green-700 flex items-center gap-1">
                        <Link2 className="w-3 h-3" />
                        {t('booking_linked') || 'Linked to Booking'}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedBooking(null);
                          setSearchQuery('');
                          setFormData({ ...formData, container_no: '' });
                        }}
                        className="p-0.5 hover:bg-green-100 rounded"
                      >
                        <X className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {selectedBooking.booking_no} • {selectedBooking.vendor_name} • {selectedBooking.truck_plate}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Dock Selection(s) */}
            {selectedJobType === 'in' && (
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                  {t('select_dock')}:
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setDockSelectorTarget('dock_to');
                    setShowDockSelector(true);
                  }}
                  className={`w-full border rounded-lg px-3 md:px-4 py-2 text-sm md:text-base text-left focus:outline-none focus:ring-2 ${
                    occupiedDockInfo ? 'border-yellow-500 focus:ring-yellow-500' : 'border-gray-300 focus:ring-blue-500'
                  } ${formData.dock_to ? 'text-gray-900' : 'text-gray-500'}`}
                >
                  {formData.dock_to ? (
                    <span className="flex items-center justify-between">
                      <span className="font-medium">{formData.dock_to}</span>
                      {dockOccupancy[formData.dock_to] && (
                        <span className="text-xs text-gray-500">
                          {dockOccupancy[formData.dock_to].containerNo.slice(-7)}
                        </span>
                      )}
                    </span>
                  ) : (
                    `-- ${t('select_dock')} --`
                  )}
                </button>

              </div>
            )}

            {/* Purpose Selection - Container IN */}
            {selectedJobType === 'in' && (
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                  {t('purpose')}:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, purpose: 'for_loading' })}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border flex items-center justify-center gap-1.5 ${
                      formData.purpose === 'for_loading'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Package className="w-4 h-4" />
                    {t('for_loading')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, purpose: 'for_unloading' })}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border flex items-center justify-center gap-1.5 ${
                      formData.purpose === 'for_unloading'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Truck className="w-4 h-4" />
                    {t('for_unloading')}
                  </button>
                </div>
              </div>
            )}

            {selectedJobType === 'out' && (
              <>
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                    {t('select_dock')}:
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setDockSelectorTarget('dock_from');
                      setShowDockSelector(true);
                    }}
                    className={`w-full border border-gray-300 rounded-lg px-3 md:px-4 py-2 text-sm md:text-base text-left focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formData.dock_from ? 'text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {formData.dock_from ? (
                      <span className="flex items-center justify-between">
                        <span className="font-medium">{formData.dock_from}</span>
                        {dockOccupancy[formData.dock_from] && (
                          <span className="text-xs text-gray-500">
                            {dockOccupancy[formData.dock_from].containerNo.slice(-7)}
                          </span>
                        )}
                      </span>
                    ) : (
                      `-- ${t('select_dock')} --`
                    )}
                  </button>
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                    {t('container_no')}:
                    {formData.dock_from && dockOccupancy[formData.dock_from] && (
                      <span className="ml-2 text-xs text-green-600 font-normal">
                        ({t('auto_display')})
                      </span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.container_no}
                        onChange={(e) => setFormData({ ...formData, container_no: e.target.value.toUpperCase() })}
                        className="w-full border border-gray-300 rounded-lg px-3 md:px-4 py-2 pr-8 text-sm md:text-base text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        placeholder="ABCU1234567"
                      />
                      {formData.container_no && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, container_no: '' })}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                          title="Clear"
                        >
                          <X className="w-4 h-4 text-gray-400" />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => setShowScanner(true)}
                      className="px-3 md:px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-xs md:text-sm flex items-center gap-1.5"
                    >
                      <ScanLine className="w-4 h-4" />
                      {t('scan_qr')}
                    </button>
                  </div>
                </div>

                {/* Completion Status Selection - Container OUT */}
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                    {t('completion_status')}:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, completion_status: 'completed' })}
                      className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border flex items-center justify-center gap-1.5 ${
                        formData.completion_status === 'completed'
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {t('status_completed')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, completion_status: 'incomplete' })}
                      className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border flex items-center justify-center gap-1.5 ${
                        formData.completion_status === 'incomplete'
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <CircleAlert className="w-4 h-4" />
                      {t('status_incomplete')}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Remark */}
            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                {t('remark')} ({t('optional')}):
              </label>
              <input
                type="text"
                value={formData.remark}
                onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 md:px-4 py-2 text-sm md:text-base text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('remark')}
              />
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                onClick={handleSubmit}
                disabled={
                  loading ||
                  (selectedJobType === 'in' && (!formData.container_no || !formData.dock_to)) ||
                  (selectedJobType === 'out' && (!formData.container_no || !formData.dock_from))
                }
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-lg transition-colors text-sm md:text-base flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    {t('confirm')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scanner Modal */}
      {showScanner && (
        <ContainerScanner
          onScan={handleScanComplete}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Dock Conflict Modal */}
      {showConflictModal && occupiedDockInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                {t('dock_occupied') || 'Dock Occupied'}
              </h3>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600 mb-2">
                {t('current_container') || 'Current container'}:
              </p>
              <p className="font-mono text-lg font-bold text-gray-900 text-center">
                {occupiedDockInfo.containerNo}
              </p>
              <p className="text-sm text-gray-500 text-center mt-1">
                → {occupiedDockInfo.dock}
              </p>
            </div>

            <p className="text-sm text-gray-600 text-center mb-4">
              {t('dock_conflict_message') || 'This dock already has a container. What would you like to do?'}
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleMoveOut}
                disabled={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
              >
                <ArrowUpFromLine className="w-4 h-4" />
                {t('move_out') || 'Move Out'}
              </button>
              <button
                onClick={handleClean}
                disabled={loading}
                className="flex-1 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {t('clean') || 'Ignore'}
              </button>
            </div>

            <button
              onClick={() => {
                setShowConflictModal(false);
                setFormData({ ...formData, dock_to: '' });
              }}
              className="w-full mt-3 text-gray-500 hover:text-gray-700 text-sm py-2"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Dock Selector Modal */}
      {showDockSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:max-w-md sm:rounded-xl sm:mx-4 rounded-t-xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-[var(--border)] shrink-0">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">{t('select_dock')}</h3>
              <button
                onClick={() => setShowDockSelector(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Dock List */}
            <div className="flex-1 overflow-y-auto p-2.5">
              <div className="space-y-1.5">
                {DOCKS.map(dock => {
                  const info = dockOccupancy[dock];
                  const pendingInfo = dockPending[dock];
                  const isSelected = dockSelectorTarget === 'dock_to'
                    ? formData.dock_to === dock
                    : formData.dock_from === dock;

                  const isPending = !!pendingInfo;
                  const isBlockedByPending = isPending && !isSelected;

                  return (
                    <button
                      key={dock}
                      onClick={() => {
                        if (isBlockedByPending) {
                          alert(`${dock} ${t('pending_jobs') || 'Pending'}`);
                          return;
                        }
                        if (dockSelectorTarget === 'dock_to') {
                          setFormData({ ...formData, dock_to: dock });
                        } else {
                          setFormData({ ...formData, dock_from: dock });
                        }
                        setShowDockSelector(false);
                      }}
                      disabled={isBlockedByPending}
                      className={`w-full px-3 py-2.5 rounded-lg border text-left transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
                          : isBlockedByPending
                          ? 'border-red-200 bg-red-50 opacity-70 cursor-not-allowed'
                          : info
                          ? 'border-amber-200 bg-amber-50 hover:border-amber-300'
                          : 'border-[var(--border)] bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isSelected ? 'bg-blue-100' : isBlockedByPending ? 'bg-red-100' : info ? 'bg-amber-100' : 'bg-gray-100'
                        }`}>
                          {isBlockedByPending ? (
                            <CircleAlert className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-red-600'}`} />
                          ) : info ? (
                            <Package className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-amber-600'}`} />
                          ) : (
                            <Check className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                          )}
                        </div>
                        <span className="font-semibold text-sm text-[var(--text-primary)]">{dock}</span>
                      </div>
                      {isBlockedByPending ? (
                        <div className="text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-extrabold">
                            {t('pending_jobs') || 'Pending'}
                          </span>
                          <div className="mt-1 text-xs font-mono text-[var(--text-secondary)]">
                            {pendingInfo.containerNo}
                          </div>
                        </div>
                      ) : info ? (
                        <div className="text-right">
                          <span className="text-xs font-mono text-[var(--text-secondary)]">{info.containerNo}</span>
                          {info.completedAt && (
                            <span className="text-[10px] text-[var(--text-muted)] ml-2">{formatDateTime(info.completedAt)}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">Available</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Clear Button */}
            <div className="p-2.5 border-t border-[var(--border)] shrink-0">
              <button
                onClick={() => {
                  if (dockSelectorTarget === 'dock_to') {
                    setFormData({ ...formData, dock_to: '' });
                  } else {
                    setFormData({ ...formData, dock_from: '' });
                  }
                  setShowDockSelector(false);
                }}
                className="w-full py-2 text-sm text-[var(--text-secondary)] hover:bg-gray-100 rounded-lg font-medium"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
