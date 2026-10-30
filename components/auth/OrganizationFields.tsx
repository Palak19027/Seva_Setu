import { ORGANIZATION_TYPES, BUSINESS_TYPES } from '@/lib/constants';
import { Field } from '@/components/ui/Field';
import { inputClass } from '@/lib/site';
import { validateDocumentFile } from '@/lib/api/storage';
import type { AccountRole } from '@/lib/types';

export interface OrganizationValues {
  organizationName: string;
  organizationType: string;
  registrationNumber: string;
  contactPerson: string;
  organizationAddress: string;
  document: File | null;
}

export const EMPTY_ORGANIZATION: OrganizationValues = {
  organizationName: '',
  organizationType: '',
  registrationNumber: '',
  contactPerson: '',
  organizationAddress: '',
  document: null,
};

export function validateOrganization(role: AccountRole, values: OrganizationValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (values.organizationName.trim().length < 2) errors.organizationName = 'Enter the organization name.';
  if (!values.organizationType) errors.organizationType = 'Select a type.';
  if (role === 'organization' && values.registrationNumber.trim().length < 3) {
    errors.registrationNumber = 'Enter the registration number.';
  }
  if (values.contactPerson.trim().length < 2) errors.contactPerson = 'Enter the contact person.';
  if (values.organizationAddress.trim().length < 5) errors.organizationAddress = 'Enter the organization address.';
  if (role === 'organization') {
    if (!values.document) errors.document = 'Upload a verification document.';
    else {
      const problem = validateDocumentFile(values.document);
      if (problem) errors.document = problem;
    }
  }
  return errors;
}

export function OrganizationFields({
  role,
  values,
  errors,
  onChange,
  onFile,
}: {
  role: AccountRole;
  values: OrganizationValues;
  errors: Record<string, string>;
  onChange: (key: keyof Omit<OrganizationValues, 'document'>, value: string) => void;
  onFile: (file: File | null) => void;
}) {
  const types = role === 'business' ? BUSINESS_TYPES : ORGANIZATION_TYPES;
  const isOrg = role === 'organization';
  return (
    <div className="space-y-5 rounded-2xl border border-primary-100 bg-secondary-50/60 p-5">
      <p className="text-sm font-bold text-primary-800">{isOrg ? 'Organization details' : 'Business details'}</p>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={isOrg ? 'Organization name' : 'Business name'} htmlFor="organizationName" required error={errors.organizationName}>
          <input id="organizationName" className={inputClass} value={values.organizationName} onChange={(e) => onChange('organizationName', e.target.value)} />
        </Field>
        <Field label={isOrg ? 'Organization type' : 'Business type'} htmlFor="organizationType" required error={errors.organizationType}>
          <select id="organizationType" className={inputClass} value={values.organizationType} onChange={(e) => onChange('organizationType', e.target.value)}>
            <option value="">Select a type</option>
            {types.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </Field>
        <Field
          label="Registration number"
          htmlFor="registrationNumber"
          required={isOrg}
          hint={isOrg ? undefined : 'Optional for businesses'}
          error={errors.registrationNumber}
        >
          <input id="registrationNumber" className={inputClass} value={values.registrationNumber} onChange={(e) => onChange('registrationNumber', e.target.value)} />
        </Field>
        <Field label="Contact person" htmlFor="contactPerson" required error={errors.contactPerson}>
          <input id="contactPerson" className={inputClass} value={values.contactPerson} onChange={(e) => onChange('contactPerson', e.target.value)} />
        </Field>
      </div>
      <Field label="Organization address" htmlFor="organizationAddress" required error={errors.organizationAddress}>
        <input id="organizationAddress" className={inputClass} value={values.organizationAddress} onChange={(e) => onChange('organizationAddress', e.target.value)} />
      </Field>
      {isOrg && (
        <Field label="Verification document" htmlFor="document" required error={errors.document} hint="PDF, JPG or PNG up to 10 MB, such as a registration certificate or trust deed">
          <input
            id="document"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-primary-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-primary-700`}
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </Field>
      )}
    </div>
  );
}
