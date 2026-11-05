"use client";

import { useLanguage } from '@/contexts/LanguageContext';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { Job, IssueType } from '@/types';
import { DEFAULTS, API_ENDPOINTS } from '@/utils/constants';
import { useJobEvents } from '@/hooks/usePusher';
import { IssueReportModal } from '@/components/shared/IssueReportModal';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  LayoutDashboard,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Bell,
  ClipboardList,
} from 'lucide-react';

export default function DriverPage() {
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusedJobId, setFocusedJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const [newJobIds, setNewJobIds] = useState<Set<string>>(new Set());
  const [showNewJobToast, setShowNewJobToast] = useState(false);

  // Track existing job IDs to detect new ones
  const existingJobIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  // Fetch and merge new jobs
  const fetchJobs = useCallback(async (isPolling = false) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.JOBS}?driver_id=${DEFAULTS.DRIVER_ID}&status=pending`);
      const data = await response.json();

      if (data.success) {
        const fetchedJobs: Job[] = data.data;
        const fetchedJobIds = new Set(fetchedJobs.map(j => j.id));

        if (isPolling && !isFirstLoadRef.current) {
          // Find new jobs that weren't in the previous list
          const newIds = new Set<string>();
          fetchedJobs.forEach(job => {
            if (!existingJobIdsRef.current.has(job.id)) {
              newIds.add(job.id);
            }
          });

          if (newIds.size > 0) {
            // Add highlight to new jobs
            setNewJobIds(prev => new Set([...prev, ...newIds]));
            setShowNewJobToast(true);

            // Clear highlight after 5 seconds
            setTimeout(() => {
              setNewJobIds(prev => {
                const updated = new Set(prev);
                newIds.forEach(id => updated.delete(id));
                return updated;
              });
            }, 5000);

            // Hide toast after 3 seconds
            setTimeout(() => setShowNewJobToast(false), 3000);
          }
        }

        // Update the jobs list
        setJobs(fetchedJobs);
        existingJobIdsRef.current = fetchedJobIds;
        isFirstLoadRef.current = false;
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchJobs(false);
  }, [fetchJobs]);

  const getCreatedAtMs = useCallback((job: Job) => {
    const value = job.created_at;
    const date = value instanceof Date ? value : new Date(value);
    const ms = date.getTime();
    return Number.isFinite(ms) ? ms : 0;
  }, []);

  const sortedJobs = [...jobs].sort((a, b) => getCreatedAtMs(a) - getCreatedAtMs(b));
  const nextJob = sortedJobs[0] ?? null;
  const focusedJob = sortedJobs.find(j => j.id === focusedJobId) ?? null;
  const displayJob = focusedJob ?? nextJob;
  const listJobs = displayJob ? sortedJobs.filter(j => j.id !== displayJob.id) : sortedJobs;

  useEffect(() => {
    if (sortedJobs.length === 0) {
      if (focusedJobId !== null) setFocusedJobId(null);
      return;
    }

    if (focusedJobId === null) {
      setFocusedJobId(sortedJobs[0].id);
      return;
    }

    const stillExists = sortedJobs.some(j => j.id === focusedJobId);
    if (!stillExists) {
      setFocusedJobId(sortedJobs[0].id);
    }
  }, [sortedJobs, focusedJobId]);

  // Listen for real-time job events via Pusher
  useJobEvents({
    onJobCreated: useCallback((data: { id: string; driver_id?: string; status: string }) => {
      // Only show notification for jobs assigned to this driver
      if (data.driver_id === DEFAULTS.DRIVER_ID && data.status === 'pending') {
        // Add highlight to new job
        setNewJobIds(prev => new Set([...prev, data.id]));
        setShowNewJobToast(true);

        // Clear highlight after 5 seconds
        setTimeout(() => {
          setNewJobIds(prev => {
            const updated = new Set(prev);
            updated.delete(data.id);
            return updated;
          });
        }, 5000);

        // Hide toast after 3 seconds
        setTimeout(() => setShowNewJobToast(false), 3000);

        // Refresh job list
        fetchJobs(false);
      }
    }, [fetchJobs]),
    onJobUpdated: useCallback((data: { id: string; driver_id?: string; status: string; priority?: number }) => {
      if (data.driver_id === DEFAULTS.DRIVER_ID && data.status === 'pending') {
        // Visual hint only (do not change focus/order)
        setNewJobIds(prev => new Set([...prev, data.id]));
        setTimeout(() => {
          setNewJobIds(prev => {
            const updated = new Set(prev);
            updated.delete(data.id);
            return updated;
          });
        }, 4000);
      }

      fetchJobs(false);
    }, [fetchJobs]),
    onJobCompleted: useCallback(() => {
      // Refresh when any job is completed (in case it affects this driver)
      fetchJobs(false);
    }, [fetchJobs]),
  });

  const handleComplete = async (job: Job) => {
    if (!confirm(`${t('confirm')} - ${t('job_done')} ${job.id}?`)) return;

    try {
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });

      if (response.ok) {
        alert(`${t('job_done')} ${job.id}`);
        fetchJobs(); // Refresh list
      } else {
        alert('Error updating job');
      }
    } catch (error) {
      console.error('Error completing job:', error);
      alert('Failed to complete job');
    }
  };

  const handleReportIssue = (job: Job) => {
    setSelectedJob(job);
    setShowIssueModal(true);
  };

  const handleIssueSubmit = async (issueType: IssueType, issueDetail?: string) => {
    if (!selectedJob) return;
    setIssueSubmitting(true);

    try {
      const response = await fetch(`/api/jobs/${selectedJob.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'issue',
          issue_type: issueType,
          issue_detail: issueDetail,
        })
      });

      if (response.ok) {
        alert(`${t('report_issue')} ${selectedJob.id}`);
        setShowIssueModal(false);
        setSelectedJob(null);
        fetchJobs();
      } else {
        alert('Error reporting issue');
      }
    } catch (error) {
      console.error('Error reporting issue:', error);
      alert('Failed to report issue');
    } finally {
      setIssueSubmitting(false);
    }
  };

  const getJobIcon = (type: string) => {
    if (type === 'in') return <ArrowDownToLine className="w-5 h-5 text-blue-600" strokeWidth={2} />;
    if (type === 'out') return <ArrowUpFromLine className="w-5 h-5 text-emerald-600" strokeWidth={2} />;
    return <ClipboardList className="w-5 h-5 text-gray-600" strokeWidth={2} />;
  };

  const getJobIconBg = (type: string) => {
    if (type === 'in') return 'bg-blue-50';
    if (type === 'out') return 'bg-emerald-50';
    return 'bg-gray-50';
  };

  const getJobTitle = (job: Job) => {
    if (job.type === 'in') return t('container_in');
    if (job.type === 'out') return t('container_out');
    return 'Job';
  };

  const getJobDockText = (job: Job) => {
    if (job.type === 'in') return job.dock_to;
    if (job.type === 'out') return job.dock_from;
    return job.dock_to || job.dock_from;
  };

  const getJobDirectionSymbol = (job: Job) => {
    if (job.type === 'in') return '→';
    if (job.type === 'out') return '←';
    return '→';
  };

  const renderHeroContainerNo = (containerNo: string) => {
    const safe = containerNo || '';
    if (safe.length <= 4) {
      return <span className="text-red-600 font-extrabold">{safe}</span>;
    }

    const prefix = safe.slice(0, -4);
    const last4 = safe.slice(-4);

    return (
      <>
        <span>{prefix}</span>
        <span className="text-red-600 font-extrabold">{last4}</span>
      </>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8 md:py-12">
        <div className="text-sm md:text-base text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:py-8 h-[calc(100vh-80px)] flex flex-col">
      {/* New Job Toast Notification */}
      {showNewJobToast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-emerald-500 text-white px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2">
            <Bell className="w-4 h-4" />
            <span className="font-medium text-sm">{t('new_jobs_available') || 'New job received!'}</span>
          </div>
        </div>
      )}

      {/* Header with Dashboard Button */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tight">{t('driver')}</h1>
        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <button
            onClick={() => fetchJobs(false)}
            className="px-3 py-2 bg-white border border-[var(--border)] hover:bg-gray-50 text-[var(--text-secondary)] rounded-lg font-medium text-sm flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">{t('refresh') || 'Refresh'}</span>
          </button>
          <Link href="/driver/dashboard">
            <button className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium text-sm flex items-center gap-1.5 transition-colors">
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">{t('dashboard')}</span>
            </button>
          </Link>
        </div>
      </div>

      {/* Job List Header */}
      <div className="flex-shrink-0 mb-3">
        <h2 className="text-base md:text-lg font-semibold text-[var(--text-secondary)] flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          {t('job_list')} ({jobs.length})
        </h2>
      </div>

      {/* Next Job Hero Card */}
      <div className="flex-shrink-0 mb-4">
        {displayJob ? (
          <div className="bg-white rounded-2xl border border-[var(--border)] p-5 md:p-6 shadow-sm relative">
            {((displayJob.priority ?? 0) > 0) && (
              <div className="absolute top-3 right-3">
                <span className="px-3 py-1 rounded-full bg-red-600 text-white text-sm font-extrabold">
                  {t('urgent') || 'Urgent'}
                </span>
              </div>
            )}
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="min-w-0">
                <div className="mt-1 text-4xl md:text-5xl font-extrabold text-[var(--text-primary)] font-mono leading-tight break-all">
                  {renderHeroContainerNo(displayJob.container_no)}
                </div>
                <div className="mt-2 text-2xl md:text-3xl font-bold text-[var(--text-secondary)] leading-tight">
                  {getJobDirectionSymbol(displayJob)} {getJobDockText(displayJob) || '-'}
                </div>
              </div>
            </div>

            {displayJob.remark && (
              <div className="mt-2 text-sm md:text-base text-[var(--text-secondary)]">
                <span className="font-semibold">{t('remark')}:</span> {displayJob.remark}
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => handleComplete(displayJob)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl transition-colors text-base md:text-lg flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                {t('job_done')}
              </button>
              <button
                onClick={() => handleReportIssue(displayJob)}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 px-4 rounded-xl transition-colors text-base md:text-lg flex items-center justify-center gap-2"
              >
                <AlertTriangle className="w-5 h-5" />
                {t('report_issue')}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[var(--border)] p-5 md:p-6 shadow-sm text-sm md:text-base text-gray-500">
            No pending jobs
          </div>
        )}
      </div>

      {/* Scrollable Job List Container */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {listJobs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 md:p-8 text-center text-sm md:text-base text-gray-500">
            No pending jobs
          </div>
        ) : (
          <div className="space-y-3 pb-4">
            {listJobs.map(job => (
              <div
                key={job.id}
                onClick={() => setFocusedJobId(job.id)}
                className={`bg-white rounded-xl border border-[var(--border)] p-4 transition-all duration-300 cursor-pointer relative ${
                  newJobIds.has(job.id)
                    ? 'ring-2 ring-emerald-500 ring-offset-2 bg-emerald-50'
                    : ''
                }`}
              >
                {((job.priority ?? 0) > 0) && (
                  <div className="absolute top-3 right-3">
                    <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-xs font-extrabold">
                      {t('urgent') || 'Urgent'}
                    </span>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  {/* Job Type Icon */}
                  <div className={`w-10 h-10 ${getJobIconBg(job.type)} rounded-lg flex items-center justify-center shrink-0`}>
                    {getJobIcon(job.type)}
                  </div>

                  {/* Job Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{getJobTitle(job)}</span>
                    </div>

                    <div className="text-base md:text-lg text-[var(--text-secondary)]">
                      {job.type === 'in' && (
                        <p><span className="font-mono font-semibold">{job.container_no}</span> → <span className="font-semibold">{job.dock_to}</span></p>
                      )}
                      {job.type === 'out' && (
                        <p><span className="font-mono font-semibold">{job.container_no}</span> ← <span className="font-semibold">{job.dock_from}</span></p>
                      )}
                    </div>

                    {job.remark && (
                      <p className="text-xs text-[var(--text-muted)] mt-1.5 truncate">
                        {t('remark')}: {job.remark}
                      </p>
                    )}
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* Issue Report Modal */}
      <IssueReportModal
        isOpen={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        job={selectedJob}
        onSubmit={handleIssueSubmit}
        loading={issueSubmitting}
      />
    </div>
  );
}
