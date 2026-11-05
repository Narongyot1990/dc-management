import type { LucideIcon } from 'lucide-react';

export interface StatusPill {
  key: string;
  count: number;
  icon: LucideIcon;
  label: string;
  bgActive: string;
  bgInactive: string;
  textInactive: string;
}

interface StatusFilterPillsProps {
  pills: StatusPill[];
  activeKey: string;
  onSelect: (key: string) => void;
}

export function StatusFilterPills({ pills, activeKey, onSelect }: StatusFilterPillsProps) {
  return (
    <div className="flex gap-1">
      {pills.map(({ key, count, icon: Icon, label, bgActive, bgInactive, textInactive }) => (
        <button
          key={key}
          onClick={() => onSelect(key)}
          className={`flex-1 py-1.5 px-0.5 rounded-lg transition-all text-center ${
            activeKey === key ? bgActive : bgInactive
          }`}
        >
          <div className="flex items-center justify-center gap-0.5">
            <Icon className={`w-3 h-3 ${activeKey === key ? 'text-white' : textInactive}`} />
            <span className={`text-sm font-bold ${activeKey === key ? 'text-white' : textInactive}`}>{count}</span>
          </div>
          <div className={`text-[8px] leading-tight ${activeKey === key ? 'text-white/80' : 'text-gray-500'}`}>
            {label}
          </div>
        </button>
      ))}
    </div>
  );
}
