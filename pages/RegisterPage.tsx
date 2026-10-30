import { useEffect, useState, type FormEvent } from 'react';
import { Link } from '@/components/ui/Link';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Field } from '@/components/ui/Field';
import { OrganizationFields, EMPTY_ORGANIZATION, validateOrganization, type OrganizationValues } from '@/components/auth/OrganizationFields';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { submitVerificationDocument } from '@/lib/api/accounts';
import { uploadVerificationDocument } from '@/lib/api/storage';
import { errorMessage } from '@/lib/format';
import { navigate } from '@/lib/navigation';
import { dashboardPathFor } from '@/lib/routes';
import { inputClass } from '@/lib/site';
import { isValidEmail, isValidPhone } from '@/lib/validation';
import type { AccountRole } from '@/lib/types';

const ROLE_OPTIONS: { value: AccountRole; title: string; text: string }[] = [
  { value: 'individual', title: 'Individual Donor', text: 'Share items from your home' },
  { value: 'business', title: 'Business Donor', text: 'Hotels, restaurants and companies' },
  { value: 'organization', title: 'Receiving Organization', text: 'NGOs, ashrams and orphanages' },
];

interface RegisterValues {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  address: string;
  city: string;
}

const EMPTY_VALUES: RegisterValues = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  address: '',
  city: '',
};

function validate(role: AccountRole, values: RegisterValues, org: OrganizationValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (values.fullName.trim().length < 2) errors.fullName = 'Enter your full name.';
  if (!isValidEmail(values.email)) errors.email = 'Enter a valid email address.';
  if (!isValidPhone(values.phone)) errors.phone = 'Enter a valid phone number.';
  if (values.password.length < 8) errors.password = 'Use at least 8 characters.';
  if (values.confirmPassword !== values.password) errors.confirmPassword = 'Passwords do not match.';
  if (values.address.trim().length < 5) errors.address = 'Enter your address.';
  if (values.city.trim().length < 2) errors.city = 'Enter your city.';
  return role === 'individual' ? errors : { ...errors, ...validateOrganization(role, org) };
}

function signUpMessage(message: string): string {
  if (/already registered|already exists/i.test(message)) return 'An account with this email already exists. Try logging in instead.';
  if (/password/i.test(message)) return 'Choose a stronger password (at least 8 characters).';
  return errorMessage(new Error(message), 'We could not create your account. Please try again.');
}

export default function RegisterPage() {
  const { profile } = useAuth();
  const [role, setRole] = useState<AccountRole>('individual');
  const [values, setValues] = useState<RegisterValues>(EMPTY_VALUES);
  const [org, setOrg] = useState<OrganizationValues>(EMPTY_ORGANIZATION);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'error' | 'warning' | 'success'; text: string } | null>(null);

  useEffect(() => {
    if (profile && !submitting) navigate(dashboardPathFor(profile.role));
  }, [profile, submitting]);

  const setField = (key: keyof RegisterValues, value: string) => {
    setValues((previous) => ({ ...previous, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    const nextErrors = validate(role, values, org);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: values.email.trim(),
        password: values.password,
        options: {
          data: {
            account_type: role,
            full_name: values.fullName.trim(),
            phone: values.phone.trim(),
            address: values.address.trim(),
            city: values.city.trim(),
            organization_name: org.organizationName.trim(),
            organization_type: org.organizationType,
            registration_number: org.registrationNumber.trim(),
            contact_person: org.contactPerson.trim(),
            organization_address: org.organizationAddress.trim(),
          },
        },
      });
      if (error) throw new Error(error.message);
      if (!data.user) throw new Error('We could not create your account. Please try again.');

      if (!data.session) {
        setNotice({ tone: 'success', text: 'Account created. Please log in with your email and password.' });
        return;
      }

      if (role === 'organization' && org.document) {
        try {
          const path = await uploadVerificationDocument(data.user.id, org.document);
          await submitVerificationDocument(path);
        } catch (docError) {
          setNotice({
            tone: 'warning',
            text: `Your account was created, but the document could not be submitted: ${errorMessage(docError)} You can upload it again from your dashboard.`,
          });
          setSubmitting(false);
          return;
        }
      }
      setSubmitting(false);
      navigate(dashboardPathFor(role));
    } catch (err) {
      setSubmitting(false);
      setNotice({ tone: 'error', text: signUpMessage(err instanceof Error ? err.message : '') });
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-800 sm:text-4xl">Create your SevaSetu account</h1>
        <p className="mt-3 text-neutral-600">Choose the option that describes you best.</p>
      </div>

      <div className="mt-10 rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-card sm:p-10">
        <fieldset>
          <legend className="text-sm font-semibold text-neutral-700">Account type</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {ROLE_OPTIONS.map((option) => {
              const selected = role === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setRole(option.value)}
                  className={`rounded-2xl border p-4 text-left transition duration-200 ${
                    selected ? 'border-primary-600 bg-secondary-100 ring-4 ring-primary-100' : 'border-neutral-200 hover:border-primary-300'
                  }`}
                >
                  <span className="block text-sm font-bold text-neutral-800">{option.title}</span>
                  <span className="mt-1 block text-xs text-neutral-500">{option.text}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full name" htmlFor="fullName" required error={errors.fullName}>
              <input id="fullName" autoComplete="name" className={inputClass} value={values.fullName} onChange={(e) => setField('fullName', e.target.value)} />
            </Field>
            <Field label="Email" htmlFor="email" required error={errors.email}>
              <input id="email" type="email" autoComplete="email" className={inputClass} value={values.email} onChange={(e) => setField('email', e.target.value)} />
            </Field>
            <Field label="Phone number" htmlFor="phone" required error={errors.phone}>
              <input id="phone" type="tel" autoComplete="tel" className={inputClass} value={values.phone} onChange={(e) => setField('phone', e.target.value)} />
            </Field>
            <Field label="City" htmlFor="city" required error={errors.city}>
              <input id="city" autoComplete="address-level2" className={inputClass} value={values.city} onChange={(e) => setField('city', e.target.value)} />
            </Field>
            <Field label="Password" htmlFor="password" required error={errors.password} hint="At least 8 characters">
              <input id="password" type="password" autoComplete="new-password" className={inputClass} value={values.password} onChange={(e) => setField('password', e.target.value)} />
            </Field>
            <Field label="Confirm password" htmlFor="confirmPassword" required error={errors.confirmPassword}>
              <input id="confirmPassword" type="password" autoComplete="new-password" className={inputClass} value={values.confirmPassword} onChange={(e) => setField('confirmPassword', e.target.value)} />
            </Field>
          </div>
          <Field label={role === 'individual' ? 'Address' : 'Personal address'} htmlFor="address" required error={errors.address}>
            <input id="address" autoComplete="street-address" className={inputClass} value={values.address} onChange={(e) => setField('address', e.target.value)} />
          </Field>

          {role !== 'individual' && (
            <OrganizationFields
              role={role}
              values={org}
              errors={errors}
              onChange={(key, value) => setOrg((previous) => ({ ...previous, [key]: value }))}
              onFile={(file) => setOrg((previous) => ({ ...previous, document: file }))}
            />
          )}

          {notice && <Alert tone={notice.tone === 'success' ? 'success' : notice.tone === 'warning' ? 'warning' : 'error'}>{notice.text}</Alert>}

          <Button type="submit" fullWidth size="lg" loading={submitting}>
            {submitting ? 'Creating your account...' : 'Create account'}
          </Button>
          <p className="text-center text-sm text-neutral-600">
            Already registered?{' '}
            <Link to="/login" className="font-semibold text-primary-700 hover:underline">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
