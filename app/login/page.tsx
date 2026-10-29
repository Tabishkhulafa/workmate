'use client';

import { type FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/browser';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const login = identifier.trim();
      const client = supabaseBrowser();
      if (!login || !password) throw new Error('Enter your email/mobile number and password.');
      if (login.includes('@')) {
        const { error: authError } = await client.auth.signInWithPassword({ email: login, password });
        if (authError) throw new Error('Invalid login credentials.');
      } else {
        const { data, error: requestError } = await client.functions.invoke('login-with-identifier', {
          body: { login, password },
        });
        if (requestError || !data || typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string') {
          throw new Error('Invalid login credentials.');
        }
        const { error: sessionError } = await client.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (sessionError) throw new Error('Unable to create login session. Please retry.');
      }
      router.replace('/dashboard');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign in failed. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  const reason = params.get('error');
  return (
    <main className="loginwrap">
      <form className="login card wm-auth-card" onSubmit={submit}>
        <div className="brand">WM <span>Work Mate</span></div>
        <h1>Welcome back</h1>
        <p className="muted">Sign in using your registered email or 10-digit mobile number.</p>
        {reason === 'change-password' && <p className="notice">Your account requires an initial password change. Complete it in the Android app before using web.</p>}
        {reason === 'profile' && <p className="notice">Profile unavailable or inactive. Contact your administrator.</p>}
        <label>Email / Mobile Number
          <input type="text" inputMode="email" autoComplete="username" required maxLength={100}
            placeholder="Email or 10-digit mobile number" value={identifier}
            onChange={event => setIdentifier(event.target.value)} disabled={busy} />
        </label>
        <label>Password
          <div className="wm-password-input">
            <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password}
              onChange={event => setPassword(event.target.value)} disabled={busy} />
            <button type="button" className="wm-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}</button>
          </div>
        </label>
        <div className="wm-auth-actions wm-auth-actions-inline">
          <span className="muted small">Use the same account and password as the Android app.</span>
          <Link href="/forgot-password">Forgot password?</Link>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  );
}

export default function Login() {
  return <Suspense fallback={<main className="loginwrap">Loading…</main>}><LoginForm /></Suspense>;
}
