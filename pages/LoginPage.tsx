import { useEffect, useState, type FormEvent } from 'react';
import { LogIn } from 'lucide-react';
import { Link } from '@/components/ui/Link';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Field } from '@/components/ui/Field';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/format';
import { navigate } from '@/lib/navigation';
import { dashboardPathFor } from '@/lib/routes';
import { inputClass } from '@/lib/site';
import { isValidEmail } from '@/lib/validation';

export default function LoginPage() {
  const { profile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile && !submitting) navigate(dashboardPathFor(profile.role));
  }, [profile, submitting]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const nextErrors: typeof errors = {};
    if (!isValidEmail(email)) nextErrors.email = 'Enter a valid email address.';
    if (!password) nextErrors.password = 'Enter your password.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setSubmitting(false);
      const invalid = /invalid login credentials/i.test(signInError.message);
      setError(invalid ? 'The email or password is incorrect.' : errorMessage(signInError, 'We could not log you in. Please try again.'));
      return;
    }
    setSubmitting(false);
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <div className="rounded-3xl border border-neutral-200/80 bg-white p-8 shadow-card sm:p-10">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary-100 text-primary-600">
          <LogIn className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-neutral-800">Welcome back</h1>
        <p className="mt-2 text-sm text-neutral-600">Log in to manage your donations and requests.</p>

        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
          <Field label="Email" htmlFor="login-email" required error={errors.email}>
            <input id="login-email" type="email" autoComplete="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password" htmlFor="login-password" required error={errors.password}>
            <input id="login-password" type="password" autoComplete="current-password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && <Alert tone="error">{error}</Alert>}
          <Button type="submit" fullWidth size="lg" loading={submitting}>
            {submitting ? 'Logging in...' : 'Log in'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-600">
          New to SevaSetu?{' '}
          <Link to="/register" className="font-semibold text-primary-700 hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
