import { useEffect, useRef, useState } from 'react';

import { login, signup } from '@/api/auth';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/cn';

type Mode = 'signup' | 'login';

interface SignUpDialogProps {
  triggerLabel?: string;
  triggerClassName?: string;
}

export function SignUpDialog({ triggerLabel = 'Sign up', triggerClassName }: SignUpDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('signup');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setError(null);
    setDisplayName('');
    setEmail('');
    setPassword('');
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await signup({ display_name: displayName, email, password });
      } else {
        await login({ email, password });
      }
      reset();
      setOpen(false);
    } catch (err) {
      setError(messageFor(err, mode));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-8 items-center rounded-sm px-3 font-mono text-xs font-bold uppercase tracking-wide bg-hazard text-black hover:opacity-90',
            triggerClassName,
          )}
          data-testid="signup-cta"
        >
          {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <header>
            <h2 className="font-display text-2xl uppercase tracking-wider">
              {mode === 'signup' ? 'Step into the cage' : 'Sign in'}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {mode === 'signup'
                ? 'Sign up to submit a fighter and track stats. We provision your sort-bot key on the backend — no API keys handled by the browser.'
                : 'Welcome back, champ. Pick up where you left off.'}
            </p>
          </header>

          {mode === 'signup' && (
            <Field
              label="Fighter / display name"
              value={displayName}
              onChange={setDisplayName}
              required
              minLength={1}
              maxLength={80}
              focusOnMount
            />
          )}
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            required
            focusOnMount={mode === 'login'}
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            required
            minLength={8}
            maxLength={200}
          />

          {error ? (
            <p role="alert" className="rounded-sm bg-hazard/10 px-3 py-2 text-sm text-hazard">
              {error}
            </p>
          ) : null}

          <div className="mt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              className="font-mono text-xs uppercase tracking-wide text-text-tertiary hover:text-text-primary"
              onClick={() => {
                setMode((m) => (m === 'signup' ? 'login' : 'signup'));
                setError(null);
              }}
            >
              {mode === 'signup' ? 'Have an account? Sign in' : 'New here? Sign up'}
            </button>
            <Button type="submit" disabled={submitting}>
              {submitting ? '...' : mode === 'signup' ? 'Sign up' : 'Sign in'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface FieldProps {
  label: string;
  type?: 'text' | 'email' | 'password';
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  focusOnMount?: boolean;
}

function Field({
  label,
  type = 'text',
  value,
  onChange,
  required,
  minLength,
  maxLength,
  focusOnMount,
}: FieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusOnMount) inputRef.current?.focus();
  }, [focusOnMount]);

  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-xs uppercase tracking-wide text-text-secondary">{label}</span>
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        className="rounded-sm border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-hazard"
      />
    </label>
  );
}

function messageFor(err: unknown, mode: Mode): string {
  if (err instanceof ApiError) {
    if (mode === 'signup' && err.status === 409) {
      return 'That email is already registered. Try signing in instead.';
    }
    if (mode === 'login' && err.status === 401) {
      return 'Email and password do not match. Try again.';
    }
    if (err.status === 502) {
      return 'sort-bot-api is unreachable right now. Please try again in a moment.';
    }
    return err.message || `Request failed (${err.status})`;
  }
  return 'Something went wrong. Please try again.';
}
