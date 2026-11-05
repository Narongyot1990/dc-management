import { RotateCcw } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onReset: () => void;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onReset,
}: DateRangePickerProps) {
  return (
    <div className="flex items-center bg-gray-100 rounded-lg px-2 py-1">
      <input
        type="date"
        value={startDate}
        onChange={(e) => onStartDateChange(e.target.value)}
        className="w-[85px] bg-transparent border-none text-[10px] text-gray-700 focus:outline-none"
      />
      <span className="text-gray-400 text-[10px] px-1">-</span>
      <input
        type="date"
        value={endDate}
        onChange={(e) => onEndDateChange(e.target.value)}
        className="w-[85px] bg-transparent border-none text-[10px] text-gray-700 focus:outline-none"
      />
      <button
        onClick={onReset}
        className="ml-1 p-1 hover:bg-gray-200 rounded text-gray-500"
      >
        <RotateCcw className="w-3 h-3" />
      </button>
    </div>
  );
}
