"use client";

import { useLanguage } from '@/contexts/LanguageContext';
import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Job } from '@/types';
import { useJobEvents } from '@/hooks/usePusher';
import { getBangkokDateString, formatTimeTH, formatDateTimeFullTH, calculateDuration } from '@/utils/format';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  LayoutDashboard,
  ArrowLeft,
  Calendar,
  Sun,
  Moon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  Timer,
  Layers
} from 'lucide-react';

interface JobDashboardProps {
  backUrl: string;
  backLabel?: string;
}

export function JobDashboard({ backUrl, backLabel }: JobDashboardProps) {
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'issue' | 'cancelled'>('all');
  const [shiftFilter, setShiftFilter] = useState<'all' | 'morning' | 'night'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    container_no: '',
    dock_from: '',
    dock_to: '',
    remark: '',
    driver_id: '',
    priority: 0,
  });

  const [selectedDate, setSelectedDate] = useState<string>(getBangkokDateString());

  const getJobIcon = (type: string, size = 'w-4 h-4') => {
    if (type === 'in') return <ArrowDownToLine className={`${size} text-blue-600`} strokeWidth={2} />;
    if (type === 'out') return <ArrowUpFromLine className={`${size} text-emerald-600`} strokeWidth={2} />;
    return <Layers className={`${size} text-gray-600`} strokeWidth={2} />;
  };

  const isInShift = (dateValue: string | Date, shift: 'all' | 'morning' | 'night') => {
    if (shift === 'all') return true;

    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    const hour = date.getHours();

    if (shift === 'morning') {
      return hour >= 7 && hour < 19;
    }

    if (shift === 'night') {
      return hour >= 19 || hour < 7;
    }

    return true;
  };

  const isSameDate = (dateValue: string | Date, targetDate: string) => {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    const target = new Date(targetDate);
    return date.getFullYear() === target.getFullYear() &&
           date.getMonth() === target.getMonth() &&
           date.getDate() === target.getDate();
  };

  const fetchJobs = async () => {
    try {
      const response = await fetch('/api/jobs');
      if (response.ok) {
        const data = await response.json();
        const jobsData = data.data || [];
        setJobs(jobsData);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const handleCancelJob = useCallback(async (job: Job) => {
    if (!confirm(`${t('confirm')} - ${t('cancel')} ${job.id}?`)) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' })
      });

      if (response.ok) {
        setSelectedJob(null);
        fetchJobs();
      } else {
        const errorData = await response.json().catch(() => null);
        const message = errorData?.error || errorData?.message || `Error cancelling job (${response.status})`;
        alert(message);
      }
    } catch (error) {
      console.error('Error cancelling job:', error);
      alert('Failed to cancel job');
    } finally {
      setIsSubmitting(false);
    }
  }, [t]);

  const handleUpdateJob = useCallback(async (jobId: string, payload: Record<string, unknown>) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        fetchJobs();
      } else {
        const errorData = await response.json().catch(() => null);
        const message = errorData?.error || errorData?.message || `Error updating job (${response.status})`;
        alert(message);
      }
    } catch (error) {
      console.error('Error updating job:', error);
      alert('Failed to update job');
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    const dateFilteredJobs = jobs.filter(job => isSameDate(job.created_at, selectedDate));
    const shiftFilteredJobs = dateFilteredJobs.filter(job => isInShift(job.created_at, shiftFilter));

    const pending = shiftFilteredJobs.filter((j: Job) => j.status === 'pending').length;
    const completed = shiftFilteredJobs.filter((j: Job) => j.status === 'completed').length;
    const issue = shiftFilteredJobs.filter((j: Job) => j.status === 'issue').length;
    const cancelled = shiftFilteredJobs.filter((j: Job) => j.status === 'cancelled').length;

    return {
      pending,
      completed,
      issue,
      cancelled,
      total: shiftFilteredJobs.length
    };
  }, [jobs, shiftFilter, selectedDate]);

  // Fetch jobs on mount
  useEffect(() => {
    fetchJobs();
  }, []);

  // Listen for real-time job events via Pusher
  useJobEvents({
    onJobCreated: useCallback(() => {
      fetchJobs();
    }, []),
    onJobUpdated: useCallback(() => {
      fetchJobs();
    }, []),
    onJobCompleted: useCallback(() => {
      fetchJobs();
    }, []),
    onJobIssue: useCallback(() => {
      fetchJobs();
    }, []),
  });

  const filteredJobs = jobs.filter(job => {
    const dateMatch = isSameDate(job.created_at, selectedDate);
    const statusMatch = filter === 'all' || job.status === filter;
    const shiftMatch = isInShift(job.created_at, shiftFilter);
    return dateMatch && statusMatch && shiftMatch;
  });

  useEffect(() => {
    if (!selectedJob) return;
    setIsEditMode(false);
    setEditForm({
      container_no: selectedJob.container_no || '',
      dock_from: selectedJob.dock_from || '',
      dock_to: selectedJob.dock_to || '',
      remark: selectedJob.remark || '',
      driver_id: selectedJob.driver_id || '',
      priority: typeof selectedJob.priority === 'number' ? selectedJob.priority : 0,
    });
  }, [selectedJob]);

  return (
    <div className="flex flex-col overflow-hidden bg-[var(--background)]" style={{ height: 'calc(100vh - 80px)' }}>
      {/* Header with Date Picker and Shift Filter */}
      <div className="shrink-0 px-3 py-2.5 md:px-4 md:py-3 bg-white border-b border-[var(--border)]">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h1 className="text-base md:text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-violet-600" />
            {t('dashboard')}
          </h1>
          <a href={backUrl}>
            <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium flex items-center gap-1.5 text-[var(--text-secondary)]">
              <ArrowLeft className="w-4 h-4" />
              {backLabel || t('back')}
            </button>
          </a>
        </div>

        {/* Date Picker */}
        <div className="flex items-center gap-2 mb-2.5">
          <label className="text-sm font-medium text-[var(--text-secondary)] whitespace-nowrap flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            {t('select_date')}:
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="flex-1 sm:flex-none border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => setSelectedDate(getBangkokDateString())}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium whitespace-nowrap"
          >
            {t('today_label')}
          </button>
        </div>

        {/* Shift Filter */}
        <div className="flex gap-2">
          <button
            onClick={() => setShiftFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
              shiftFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('all_shifts')}
          </button>
          <button
            onClick={() => setShiftFilter('morning')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
              shiftFilter === 'morning'
                ? 'bg-amber-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Sun className="w-4 h-4" />
            {t('morning_shift')}
          </button>
          <button
            onClick={() => setShiftFilter('night')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
              shiftFilter === 'night'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Moon className="w-4 h-4" />
            {t('night_shift')}
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="shrink-0 px-3 md:px-4 py-2.5 md:py-3">
        <div className="grid grid-cols-5 gap-2 md:gap-3">
          <button
            onClick={() => setFilter('pending')}
            className={`bg-white border rounded-xl p-2.5 md:p-3 transition-all ${
              filter === 'pending' ? 'border-amber-400 ring-2 ring-amber-100' : 'border-[var(--border)] hover:border-amber-200'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl md:text-2xl font-bold text-amber-600">{stats.pending}</div>
            <div className="text-[10px] md:text-xs text-[var(--text-muted)] font-medium">{t('pending_jobs')}</div>
          </button>

          <button
            onClick={() => setFilter('completed')}
            className={`bg-white border rounded-xl p-2.5 md:p-3 transition-all ${
              filter === 'completed' ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-[var(--border)] hover:border-emerald-200'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl md:text-2xl font-bold text-emerald-600">{stats.completed}</div>
            <div className="text-[10px] md:text-xs text-[var(--text-muted)] font-medium">{t('completed_jobs')}</div>
          </button>

          <button
            onClick={() => setFilter('issue')}
            className={`bg-white border rounded-xl p-2.5 md:p-3 transition-all ${
              filter === 'issue' ? 'border-red-400 ring-2 ring-red-100' : 'border-[var(--border)] hover:border-red-200'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            <div className="text-xl md:text-2xl font-bold text-red-600">{stats.issue}</div>
            <div className="text-[10px] md:text-xs text-[var(--text-muted)] font-medium">{t('issue_jobs')}</div>
          </button>

          <button
            onClick={() => setFilter('cancelled')}
            className={`bg-white border rounded-xl p-2.5 md:p-3 transition-all ${
              filter === 'cancelled' ? 'border-gray-400 ring-2 ring-gray-100' : 'border-[var(--border)] hover:border-gray-200'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <X className="w-4 h-4 text-gray-500" />
            </div>
            <div className="text-xl md:text-2xl font-bold text-gray-700">{stats.cancelled}</div>
            <div className="text-[10px] md:text-xs text-[var(--text-muted)] font-medium">{t('cancelled') || 'Cancelled'}</div>
          </button>

          <button
            onClick={() => setFilter('all')}
            className={`bg-white border rounded-xl p-2.5 md:p-3 transition-all ${
              filter === 'all' ? 'border-blue-400 ring-2 ring-blue-100' : 'border-[var(--border)] hover:border-blue-200'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Layers className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-xl md:text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-[10px] md:text-xs text-[var(--text-muted)] font-medium">{t('total_jobs')}</div>
          </button>
        </div>
      </div>

      {/* Jobs List */}
      <div className="flex-1 px-3 md:px-4 pb-2 md:pb-3 overflow-hidden min-h-0">
        <div className="bg-white rounded-xl border border-[var(--border)] h-full flex flex-col p-3 md:p-4">
          <h3 className="text-sm md:text-base font-semibold text-[var(--text-primary)] mb-2 shrink-0">
            {t('job_count')} ({filteredJobs.length})
          </h3>

          {filteredJobs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-[var(--text-muted)] text-sm">{t('no_jobs_in_category')}</div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2">
              {filteredJobs.map((job) => (
                <div
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className={`border rounded-lg bg-white hover:shadow-sm transition cursor-pointer p-3 ${
                    job.status === 'pending' ? 'border-l-4 border-l-amber-400 border-t-[var(--border)] border-r-[var(--border)] border-b-[var(--border)]' :
                    job.status === 'completed' ? 'border-l-4 border-l-emerald-400 border-t-[var(--border)] border-r-[var(--border)] border-b-[var(--border)]' :
                    'border-l-4 border-l-red-400 border-t-[var(--border)] border-r-[var(--border)] border-b-[var(--border)]'
                  }`}
                >
                  {/* Row 1: Type Badge + Status */}
                  <div className="flex items-center justify-between mb-2">
                    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold ${
                      job.type === 'in'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {getJobIcon(job.type, 'w-3 h-3')}
                      <span>{job.type === 'in' ? 'IN' : 'OUT'}</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      job.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                      job.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                      'bg-red-50 text-red-700'
                    }`}>
                      {job.status === 'pending' && t('pending_jobs')}
                      {job.status === 'completed' && t('completed_jobs')}
                      {job.status === 'issue' && t('issue_jobs')}
                    </span>
                  </div>

                  {/* Row 2: Container → Dock */}
                  <div className="font-mono text-sm text-[var(--text-primary)] mb-2 tracking-wide">
                    {job.type === 'in' ? (
                      <span>
                        <span className="font-semibold">{job.container_no || '---'}</span>
                        <span className="text-blue-500 mx-2">→</span>
                        <span className="text-[var(--text-muted)]">{job.dock_to || '---'}</span>
                      </span>
                    ) : (
                      <span>
                        <span className="font-semibold">{job.container_no || '---'}</span>
                        <span className="text-emerald-500 mx-2">←</span>
                        <span className="text-[var(--text-muted)]">{job.dock_from || '---'}</span>
                      </span>
                    )}
                  </div>

                  {/* Row 3: Time info */}
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                    <span>
                      {job.completed_at && formatTimeTH(job.completed_at)}
                    </span>
                    {job.completed_at ? (
                      <span className="text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {calculateDuration(job.created_at, job.completed_at)}
                      </span>
                    ) : (
                      <span className="text-amber-600 flex items-center gap-1">
                        <Timer className="w-3 h-3" />
                        {t('in_progress')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  selectedJob.type === 'in' ? 'bg-blue-50' : 'bg-emerald-50'
                }`}>
                  {getJobIcon(selectedJob.type, 'w-4 h-4')}
                </div>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  {t('job_details')}
                </h3>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Status Badge */}
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-block text-xs md:text-sm px-3 py-1 rounded-full font-medium ${
                  selectedJob.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  selectedJob.status === 'completed' ? 'bg-green-100 text-green-700' :
                  selectedJob.status === 'cancelled' ? 'bg-gray-100 text-gray-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {selectedJob.status === 'pending' && t('pending_jobs')}
                  {selectedJob.status === 'completed' && t('completed_jobs')}
                  {selectedJob.status === 'issue' && t('issue_jobs')}
                  {selectedJob.status === 'cancelled' && (t('cancelled') || 'Cancelled')}
                </span>

                {((selectedJob.priority ?? 0) > 0) && (
                  <span className="inline-block text-xs md:text-sm px-3 py-1 rounded-full font-extrabold bg-red-600 text-white">
                    {t('urgent') || 'Urgent'}
                  </span>
                )}
              </div>

              {/* Job Type */}
              <div className="border-b border-gray-300 pb-2">
                <label className="text-xs md:text-sm text-gray-700 font-semibold">{t('job_type_label')}:</label>
                <p className="text-sm md:text-base font-medium text-gray-900">
                  {selectedJob.type === 'in' && t('container_in')}
                  {selectedJob.type === 'out' && t('container_out')}
                </p>
              </div>

              {/* Container Number */}
              <div className="border-b border-gray-300 pb-2">
                <label className="text-xs md:text-sm text-gray-700 font-semibold">{t('container_number')}:</label>
                {isEditMode ? (
                  <input
                    value={editForm.container_no}
                    onChange={(e) => setEditForm((p) => ({ ...p, container_no: e.target.value }))}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                ) : (
                  <p className="text-sm md:text-base font-medium text-gray-900">{selectedJob.container_no}</p>
                )}
              </div>

              {/* Dock Info */}
              {selectedJob.type === 'out' && (selectedJob.dock_from || isEditMode) && (
                <div className="border-b border-gray-300 pb-2">
                  <label className="text-xs md:text-sm text-gray-700 font-semibold">{t('dock_from')}:</label>
                  {isEditMode ? (
                    <input
                      value={editForm.dock_from}
                      onChange={(e) => setEditForm((p) => ({ ...p, dock_from: e.target.value }))}
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  ) : (
                    <p className="text-sm md:text-base font-medium text-gray-900">{selectedJob.dock_from}</p>
                  )}
                </div>
              )}
              {selectedJob.type === 'in' && (selectedJob.dock_to || isEditMode) && (
                <div className="border-b border-gray-300 pb-2">
                  <label className="text-xs md:text-sm text-gray-700 font-semibold">{t('dock_to')}:</label>
                  {isEditMode ? (
                    <input
                      value={editForm.dock_to}
                      onChange={(e) => setEditForm((p) => ({ ...p, dock_to: e.target.value }))}
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  ) : (
                    <p className="text-sm md:text-base font-medium text-gray-900">{selectedJob.dock_to}</p>
                  )}
                </div>
              )}

              {/* Remark */}
              {(isEditMode || selectedJob.remark) && (
                <div className="border-b border-gray-300 pb-2">
                  <label className="text-xs md:text-sm text-gray-700 font-semibold">{t('remark')}:</label>
                  {isEditMode ? (
                    <input
                      value={editForm.remark}
                      onChange={(e) => setEditForm((p) => ({ ...p, remark: e.target.value }))}
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  ) : (
                    <p className="text-sm md:text-base text-gray-900">{selectedJob.remark}</p>
                  )}
                </div>
              )}

              {/* Priority (edit only) */}
              {isEditMode && (
                <div className="border-b border-gray-300 pb-3">
                  <label className="text-xs md:text-sm text-gray-700 font-semibold">{t('priority') || 'Priority'}:</label>
                  <div className="mt-2 flex items-center gap-2">
                    <select
                      value={editForm.priority}
                      onChange={(e) => setEditForm((p) => ({ ...p, priority: Number(e.target.value) }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      <option value={0}>{t('not_urgent') || 'Not urgent'}</option>
                      <option value={1}>{t('urgent') || 'Urgent'}</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="border-b border-gray-300 pb-2">
                <label className="text-xs md:text-sm text-gray-700 font-semibold">{t('created_at')}:</label>
                <p className="text-sm md:text-base text-gray-900">{formatDateTimeFullTH(selectedJob.created_at)}</p>
              </div>

              {selectedJob.completed_at && (
                <div className="border-b border-gray-300 pb-2">
                  <label className="text-xs md:text-sm text-gray-700 font-semibold">{t('completed_at')}:</label>
                  <p className="text-sm md:text-base text-gray-900">{formatDateTimeFullTH(selectedJob.completed_at)}</p>
                </div>
              )}

              {/* Issue Info */}
              {selectedJob.issue_type && (
                <>
                  <div className="border-b border-gray-300 pb-2">
                    <label className="text-xs md:text-sm text-gray-700 font-semibold">{t('issue_type')}:</label>
                    <p className="text-sm md:text-base text-gray-900">
                      {selectedJob.issue_type === 'not_found' && `🔍 ${t('issue_not_found')}`}
                      {selectedJob.issue_type === 'wrong_number' && `🔢 ${t('issue_wrong_number')}`}
                      {selectedJob.issue_type === 'duplicate' && `🔄 ${t('issue_duplicate')}`}
                      {selectedJob.issue_type === 'other' && `📝 ${t('issue_other')}`}
                    </p>
                  </div>
                  {selectedJob.issue_detail && (
                    <div className="border-b border-gray-300 pb-2">
                      <label className="text-xs md:text-sm text-gray-700 font-semibold">{t('issue_detail')}:</label>
                      <p className="text-sm md:text-base text-gray-900">{selectedJob.issue_detail}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
              {!isEditMode ? (
                <>
                  <button
                    onClick={() => setIsEditMode(true)}
                    disabled={isSubmitting}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
                  >
                    {t('edit') || 'Edit'}
                  </button>
                  {(selectedJob.status === 'pending') && (
                    <button
                      onClick={() => handleCancelJob(selectedJob)}
                      disabled={isSubmitting}
                      className="flex-1 bg-gray-700 hover:bg-gray-800 disabled:bg-gray-300 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      {t('cancel')}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setIsEditMode(false);
                      setEditForm({
                        container_no: selectedJob.container_no || '',
                        dock_from: selectedJob.dock_from || '',
                        dock_to: selectedJob.dock_to || '',
                        remark: selectedJob.remark || '',
                        driver_id: selectedJob.driver_id || '',
                        priority: typeof selectedJob.priority === 'number' ? selectedJob.priority : 0,
                      });
                    }}
                    disabled={isSubmitting}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-300 text-gray-700 font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={() => {
                      handleUpdateJob(selectedJob.id, {
                        container_no: editForm.container_no,
                        dock_from: selectedJob.type === 'out' ? (editForm.dock_from || undefined) : undefined,
                        dock_to: selectedJob.type === 'in' ? (editForm.dock_to || undefined) : undefined,
                        remark: editForm.remark || undefined,
                        driver_id: editForm.driver_id || undefined,
                        priority: editForm.priority,
                      });
                      setIsEditMode(false);
                    }}
                    disabled={isSubmitting}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
                  >
                    {t('save') || 'Save'}
                  </button>
                </>
              )}
            </div>

            <button
              onClick={() => setSelectedJob(null)}
              className="w-full mt-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
            >
              {t('close')}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
