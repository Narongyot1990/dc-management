"use client";

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { X, Loader2, LogIn } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { t } = useLanguage();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setUsername('');
    setPassword('');
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError(null);
    const result = await login(username, password);
    setLoading(false);
    if (result.success) {
      handleClose();
    } else {
      setError(t('login_error_invalid'));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4" onClick={handleClose}>
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl p-5 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <LogIn className="w-5 h-5 text-[#006cb3]" />
            {t('login_title')}
          </h2>
          <button type="button" onClick={handleClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">{t('login_username')}</label>
            <input
              type="text"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#006cb3] focus:border-transparent"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">{t('login_password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#006cb3] focus:border-transparent"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-2.5 bg-[#006cb3] hover:bg-[#00568f] disabled:bg-gray-300 disabled:text-gray-500 text-white font-medium rounded-lg text-sm flex items-center justify-center gap-1.5"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? t('login_logging_in') : t('login_submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
