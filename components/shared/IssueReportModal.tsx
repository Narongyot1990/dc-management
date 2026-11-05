"use client";

import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Job, IssueType } from '@/types';
import {
  AlertTriangle,
  X,
  CheckCircle2,
  ArrowDownToLine,
  ArrowUpFromLine,
  Layers,
} from 'lucide-react';

interface IssueReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job | null;
  onSubmit: (issueType: IssueType, issueDetail?: string) => Promise<void>;
  loading?: boolean;
}

export function IssueReportModal({ isOpen, onClose, job, onSubmit, loading }: IssueReportModalProps) {
  const { t } = useLanguage();
  const [issueType, setIssueType] = useState<IssueType>('not_found');
  const [issueDetail, setIssueDetail] = useState('');

  if (!isOpen || !job) return null;

  const getJobIcon = (type: string) => {
    if (type === 'in') return <ArrowDownToLine className="w-3.5 h-3.5 text-blue-600" strokeWidth={2} />;
    if (type === 'out') return <ArrowUpFromLine className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2} />;
    return <Layers className="w-3.5 h-3.5 text-gray-600" strokeWidth={2} />;
  };

  const getJobIconBg = (type: string) => {
    if (type === 'in') return 'bg-blue-50';
    if (type === 'out') return 'bg-emerald-50';
    return 'bg-gray-50';
  };

  const handleSubmit = async () => {
    await onSubmit(issueType, issueType === 'other' ? issueDetail : undefined);
    setIssueType('not_found');
    setIssueDetail('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              {t('report_issue')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-6 h-6 ${getJobIconBg(job.type)} rounded flex items-center justify-center`}>
              {getJobIcon(job.type)}
            </div>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {job.type === 'in' ? t('container_in') : job.type === 'out' ? t('container_out') : t('container_swap')}
            </span>
          </div>
          <p className="text-sm font-mono text-[var(--text-secondary)]">
            {job.container_no}
          </p>
          {job.remark && (
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {t('remark')}: {job.remark}
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              {t('select_issue')}:
            </label>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value as IssueType)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="not_found">{t('issue_not_found')}</option>
              <option value="wrong_number">{t('issue_wrong_number')}</option>
              <option value="duplicate">{t('issue_duplicate')}</option>
              <option value="other">{t('issue_other')}</option>
            </select>
          </div>

          {issueType === 'other' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                {t('issue_detail')}:
              </label>
              <textarea
                value={issueDetail}
                onChange={(e) => setIssueDetail(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder={t('issue_detail')}
              />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || (issueType === 'other' && !issueDetail)}
              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {loading ? '...' : t('send_report')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
