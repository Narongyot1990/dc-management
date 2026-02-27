interface InputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  highlight?: boolean;
  hint?: string;
  type?: string;
  compact?: boolean;
}

export default function Input({
  label, value, onChange, placeholder, highlight, hint, type = 'text', compact,
}: InputProps) {
  return (
    <div>
      <label className={compact ? 'block text-xs text-gray-400 mb-0.5' : 'block text-sm font-medium text-gray-600 mb-1'}>
        {label}
        {hint && <span className="ml-1 text-xs text-orange-500">{hint}</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border text-gray-800 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          compact ? 'px-2 py-1.5 text-sm' : 'px-3 py-2.5'
        } ${highlight ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}`}
      />
    </div>
  );
}
