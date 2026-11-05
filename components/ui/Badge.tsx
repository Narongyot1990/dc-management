"use client";

import { getBadgeColor } from '@/utils/styles';
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Clock, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

interface BadgeProps {
  status: string;
  label?: string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

/**
 * Status Badge Component
 */
export function Badge({ status, label, size = 'sm', showIcon = false }: BadgeProps) {
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
  };

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  const getStatusIcon = () => {
    switch (status.toLowerCase()) {
      case 'pending':
        return <Clock className={iconSize} />;
      case 'in_progress':
      case 'in progress':
        return <Loader2 className={`${iconSize} animate-spin`} />;
      case 'completed':
      case 'done':
        return <CheckCircle2 className={iconSize} />;
      case 'issue':
      case 'error':
        return <AlertTriangle className={iconSize} />;
      default:
        return null;
    }
  };

  return (
    <span
      className={`${getBadgeColor(status)} ${sizeClasses[size]} rounded font-medium inline-flex items-center gap-1`}
    >
      {showIcon && getStatusIcon()}
      {label || status}
    </span>
  );
}

/**
 * Job Type Badge
 */
interface JobTypeBadgeProps {
  type: 'in' | 'out' | 'swap';
  size?: 'sm' | 'md';
}

export function JobTypeBadge({ type, size = 'sm' }: JobTypeBadgeProps) {
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  const config = {
    in: {
      icon: <ArrowDownToLine className={iconSize} strokeWidth={2.5} />,
      bg: 'bg-blue-50 text-blue-700 border border-blue-200',
      label: 'IN'
    },
    out: {
      icon: <ArrowUpFromLine className={iconSize} strokeWidth={2.5} />,
      bg: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      label: 'OUT'
    },
    swap: {
      icon: <ArrowLeftRight className={iconSize} strokeWidth={2.5} />,
      bg: 'bg-violet-50 text-violet-700 border border-violet-200',
      label: 'SWAP'
    },
  };

  const { icon, bg, label } = config[type];

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  };

  return (
    <span className={`${bg} ${sizeClasses[size]} rounded-md font-semibold inline-flex items-center gap-1.5`}>
      {icon}
      <span>{label}</span>
    </span>
  );
}
