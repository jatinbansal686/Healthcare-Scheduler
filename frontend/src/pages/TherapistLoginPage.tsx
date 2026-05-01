// ============================================================
// pages/TherapistLoginPage.tsx
// Therapist login — Supabase email+password auth
// Matches existing LoginPage.tsx style and pattern
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ErrorBanner } from '../components/ui/ ErrorBanner';
import { useTherapistAuth } from '../hooks/useTherapistAuth';
import { logger } from '../lib/logger';

const CONTEXT = 'TherapistLoginPage';

const TherapistLoginPage: React.FC = () => {
  logger.info(CONTEXT, 'TherapistLoginPage mounted');

  const navigate = useNavigate();
  const { session, signIn, isLoading, error } = useTherapistAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      logger.info(CONTEXT, 'Already authenticated — redirecting to therapist dashboard');
      navigate('/therapist/dashboard', { replace: true });
    }
  }, [session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email.trim() || !password.trim()) {
      setLocalError('Email and password are required.');
      return;
    }

    try {
      await signIn(email.trim(), password);
      navigate('/therapist/dashboard', { replace: true });
    } catch {
      setLocalError(error ?? 'Login failed. Please check your credentials.');
    }
  };

  const displayError = localError ?? error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white text-2xl font-bold mb-4">
            Rx
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Therapist Portal</h1>
          <p className="text-slate-500 text-sm mt-1">HealthScheduler — Manage your appointments</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-md p-8">
          <h2 className="text-lg font-semibold text-slate-700 mb-6">Sign in to continue</h2>

          <ErrorBanner message={displayError} onDismiss={() => setLocalError(null)} />

          <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
            <div>
              <label htmlFor="therapist-email" className="block text-sm font-medium text-slate-700 mb-1">
                Email address
              </label>
              <input
                id="therapist-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none transition-colors"
                placeholder="therapist@clinic.com"
              />
            </div>

            <div>
              <label htmlFor="therapist-password" className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                id="therapist-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none transition-colors"
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" isLoading={isLoading} className="w-full mt-2" size="lg">
              Sign In
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Admin?{' '}
          <a href="/login" className="text-emerald-600 hover:underline">Admin portal →</a>
          {' · '}
          Patient?{' '}
          <a href="/" className="text-emerald-600 hover:underline">Use the chat →</a>
        </p>
      </div>
    </div>
  );
};

export default TherapistLoginPage;