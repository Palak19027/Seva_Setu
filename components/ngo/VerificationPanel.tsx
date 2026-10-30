import { useState } from 'react';
import { FileUp, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Field } from '@/components/ui/Field';
import { VerificationBadge } from '@/components/ui/Badge';
import { useAuth } from '@/contexts/auth-context';
import { submitVerificationDocument } from '@/lib/api/accounts';
import { uploadVerificationDocument, validateDocumentFile } from '@/lib/api/storage';
import { errorMessage } from '@/lib/format';

export function VerificationPanel() {
  const { profile, organization, refreshAccount } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!organization || !profile) return null;
  const status = organization.verification_status;
  const verified = status === 'verified';

  const upload = async () => {
    setError(null);
    setSuccess(null);
    if (!file) {
      setError('Choose a PDF, JPG or PNG document first.');
      return;
    }
    const problem = validateDocumentFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    try {
      const path = await uploadVerificationDocument(profile.id, file);
      await submitVerificationDocument(path);
      await refreshAccount();
      setFile(null);
      setSuccess('Your document was submitted. Our team will review it shortly.');
    } catch (err) {
      setError(errorMessage(err, 'The document could not be submitted. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${verified ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'}`}>
            {verified ? <ShieldCheck className="h-5 w-5" aria-hidden /> : <ShieldAlert className="h-5 w-5" aria-hidden />}
          </span>
          <div>
            <p className="text-base font-bold text-neutral-800">Organization verification</p>
            <p className="mt-1 text-sm text-neutral-500">
              {verified
                ? 'Your organization is verified and can request donations.'
                : 'Only verified organizations can request donations. Upload your registration documents to get verified.'}
            </p>
          </div>
        </div>
        <VerificationBadge status={status} />
      </div>

      {status === 'rejected' && organization.rejection_reason && (
        <div className="mt-4">
          <Alert tone="error">Your last submission was declined: {organization.rejection_reason}. Please upload a corrected document.</Alert>
        </div>
      )}
      {status === 'pending' && organization.verification_document_path && (
        <p className="mt-4 text-sm text-neutral-600">Your document is under review.</p>
      )}

      {!verified && (
        <div className="mt-5 space-y-4 border-t border-neutral-100 pt-5">
          <Field label="Replace or upload document" htmlFor="verification-file" hint="PDF, JPG or PNG up to 10 MB">
            <input
              id="verification-file"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
            />
          </Field>
          {error && <Alert tone="error">{error}</Alert>}
          {success && <Alert tone="success">{success}</Alert>}
          <Button onClick={() => void upload()} loading={submitting} icon={<FileUp className="h-4 w-4" />}>Submit document</Button>
        </div>
      )}
    </div>
  );
}
