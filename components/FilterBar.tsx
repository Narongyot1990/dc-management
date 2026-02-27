'use client';

import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import Input from '@/components/ui/Input';
import type { DOFilter } from '@/types';

interface FilterBarProps {
  filters: DOFilter;
  onFilterChange: (filters: DOFilter) => void;
  total: number;
}

export default function FilterBar({ filters, onFilterChange, total }: FilterBarProps) {
  const { t } = useLanguage();
  const [showFilters, setShowFilters] = useState(false);

  const set = (field: keyof DOFilter, value: string | boolean) => {
    onFilterChange({ ...filters, [field]: value });
  };

  const handleClear = () => {
    onFilterChange({ search: '', date_from: '', date_to: '', destination_branch: '', missing_trip_no: false });
  };

  const hasActiveFilters = filters.date_from || filters.date_to || filters.destination_branch || filters.missing_trip_no;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-3 space-y-2">
        {/* Search + Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={`${t('search')} DC, ${t('driver_name')}, ${t('truck_plate_head')}...`}
              value={filters.search}
              onChange={(e) => set('search', e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-gray-800 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-lg border text-sm font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
              hasActiveFilters ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {t('filter')}
          </button>
        </div>

        {/* Missing Trip No Toggle */}
        <button
          onClick={() => set('missing_trip_no', !filters.missing_trip_no)}
          className={`w-full py-2 px-3 rounded-lg border text-sm font-medium flex items-center gap-2 transition-colors ${
            filters.missing_trip_no ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          {t('filter_no_trip_no')}
        </button>

        {/* Expandable Filters */}
        {showFilters && (
          <div className="pt-2 border-t border-gray-100 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <Input compact label={t('destination_branch')} value={filters.destination_branch} onChange={(v) => set('destination_branch', v)} />
              <Input compact label={t('date_from')} value={filters.date_from} onChange={(v) => set('date_from', v)} type="date" />
              <Input compact label={t('date_to')} value={filters.date_to} onChange={(v) => set('date_to', v)} type="date" />
            </div>
            {hasActiveFilters && (
              <button onClick={handleClear} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                {t('clear_filters')}
              </button>
            )}
          </div>
        )}

        {/* Total */}
        <div className="text-xs text-gray-400">
          {t('total_records')}: <span className="font-semibold text-gray-600">{total}</span> {t('records')}
        </div>
      </div>
    </div>
  );
}
