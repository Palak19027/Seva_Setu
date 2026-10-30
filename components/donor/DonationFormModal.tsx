import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Field } from '@/components/ui/Field';
import { createDonation, updateDonation, type DonationInput } from '@/lib/api/donations';
import { donationImageUrl, MAX_DONATION_IMAGES, removeDonationImages, uploadDonationImages, validateImageFile } from '@/lib/api/storage';
import { CATEGORIES, CONDITIONS } from '@/lib/constants';
import { errorMessage, isPast, toLocalInputValue } from '@/lib/format';
import { inputClass } from '@/lib/site';
import type { Donation } from '@/lib/types';

interface FormState {
  title: string;
  category: string;
  description: string;
  quantity: string;
  unit: string;
  item_condition: string;
  city: string;
  pickup_address: string;
  contact_info: string;
  available_until: string;
  food_prepared_at: string;
  food_veg_type: string;
  food_storage_conditions: string;
  food_allergen_info: string;
  safe_pickup_deadline: string;
  latitude: string;
  longitude: string;
}

function initialState(donation: Donation | null): FormState {
  return {
    title: donation?.title ?? '',
    category: donation?.category ?? '',
    description: donation?.description ?? '',
    quantity: donation ? String(donation.quantity) : '',
    unit: donation?.unit ?? '',
    item_condition: donation?.item_condition ?? '',
    city: donation?.city ?? '',
    pickup_address: donation?.pickup_address ?? '',
    contact_info: donation?.contact_info ?? '',
    available_until: toLocalInputValue(donation?.available_until),
    food_prepared_at: toLocalInputValue(donation?.food_prepared_at),
    food_veg_type: donation?.food_veg_type ?? '',
    food_storage_conditions: donation?.food_storage_conditions ?? '',
    food_allergen_info: donation?.food_allergen_info ?? '',
    safe_pickup_deadline: toLocalInputValue(donation?.safe_pickup_deadline),
    latitude: donation?.latitude != null ? String(donation.latitude) : '',
    longitude: donation?.longitude != null ? String(donation.longitude) : '',
  };
}

function parseCoordinate(value: string): number | null {
  return value.trim() === '' ? null : Number(value);
}

function validate(values: FormState, imageCount: number): Record<string, string> {
  const errors: Record<string, string> = {};
  const until = values.available_until ? new Date(values.available_until) : null;
  if (values.title.trim().length < 3) errors.title = 'Give the donation a title of at least 3 characters.';
  if (!values.category) errors.category = 'Choose a category.';
  if (values.description.length > 1000) errors.description = 'Keep the description under 1000 characters.';
  if (!(Number(values.quantity) > 0)) errors.quantity = 'Enter a quantity greater than zero.';
  if (values.unit.trim().length < 1) errors.unit = 'Enter a unit, such as kg, boxes or pieces.';
  if (!values.item_condition) errors.item_condition = 'Choose the item condition.';
  if (imageCount > MAX_DONATION_IMAGES) errors.images = `Add at most ${MAX_DONATION_IMAGES} images.`;
  if (values.city.trim().length < 2) errors.city = 'Enter the city.';
  if (values.pickup_address.trim().length < 5) errors.pickup_address = 'Enter a full pickup address.';
  if (values.contact_info.trim().length < 5) errors.contact_info = 'Enter a phone number or email for the pickup team.';
  const latitude = parseCoordinate(values.latitude);
  const longitude = parseCoordinate(values.longitude);
  if (values.category === 'food' && (latitude === null || longitude === null)) {
    errors.location = 'Set the pickup location so nearby NGOs can be alerted.';
  } else if (latitude !== null || longitude !== null) {
    if (latitude === null || longitude === null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      errors.location = 'Enter both latitude and longitude, or leave both empty.';
    } else if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      errors.location = 'The coordinates are out of range.';
    }
  }
  if (!until) errors.available_until = 'Choose when the donation is available until.';
  else if (until.getTime() <= Date.now()) errors.available_until = 'The availability end time must be in the future.';

  if (values.category === 'food') {
    const prepared = values.food_prepared_at ? new Date(values.food_prepared_at) : null;
    const deadline = values.safe_pickup_deadline ? new Date(values.safe_pickup_deadline) : null;
    if (!prepared) errors.food_prepared_at = 'Enter when the food was prepared.';
    else if (prepared.getTime() > Date.now()) errors.food_prepared_at = 'The preparation time cannot be in the future.';
    if (!values.food_veg_type) errors.food_veg_type = 'Select vegetarian or non-vegetarian.';
    if (!deadline) errors.safe_pickup_deadline = 'Set the safe pickup deadline for this food.';
    else if (deadline.getTime() <= Date.now()) errors.safe_pickup_deadline = 'The safe pickup deadline must be in the future.';
    else if (until && deadline.getTime() > until.getTime()) errors.safe_pickup_deadline = 'The safe pickup deadline cannot be after the availability end time.';
  }
  return errors;
}

function toPayload(values: FormState, imagePaths: string[]): DonationInput {
  const isFood = values.category === 'food';
  return {
    title: values.title.trim(),
    category: values.category as DonationInput['category'],
    description: values.description.trim(),
    quantity: Number(values.quantity),
    unit: values.unit.trim(),
    item_condition: values.item_condition as DonationInput['item_condition'],
    image_paths: imagePaths,
    pickup_address: values.pickup_address.trim(),
    city: values.city.trim(),
    available_until: new Date(values.available_until).toISOString(),
    contact_info: values.contact_info.trim(),
    food_prepared_at: isFood ? new Date(values.food_prepared_at).toISOString() : null,
    food_veg_type: isFood ? (values.food_veg_type as DonationInput['food_veg_type']) : null,
    food_storage_conditions: isFood ? values.food_storage_conditions.trim() || null : null,
    food_allergen_info: isFood ? values.food_allergen_info.trim() || null : null,
    safe_pickup_deadline: isFood ? new Date(values.safe_pickup_deadline).toISOString() : null,
    latitude: parseCoordinate(values.latitude),
    longitude: parseCoordinate(values.longitude),
  };
}

export function DonationFormModal({
  open,
  donation,
  donorId,
  onClose,
  onSaved,
}: {
  open: boolean;
  donation: Donation | null;
  donorId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<FormState>(() => initialState(donation));
  const [keptImages, setKeptImages] = useState<string[]>(donation?.image_paths ?? []);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValues(initialState(donation));
    setKeptImages(donation?.image_paths ?? []);
    setNewFiles([]);
    setErrors({});
    setError(null);
  }, [open, donation]);

  const previews = useMemo(() => newFiles.map((file) => ({ file, url: URL.createObjectURL(file) })), [newFiles]);
  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);

  const isFood = values.category === 'food';
  const imageCount = keptImages.length + newFiles.length;
  const set = (key: keyof FormState) => (event: { target: { value: string } }) =>
    setValues((previous) => ({ ...previous, [key]: event.target.value }));

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const accepted: File[] = [];
    for (const file of Array.from(files)) {
      const problem = validateImageFile(file);
      if (problem) {
        setError(problem);
        continue;
      }
      accepted.push(file);
    }
    const room = MAX_DONATION_IMAGES - imageCount;
    if (accepted.length > room) setError(`You can add ${Math.max(room, 0)} more image(s).`);
    setNewFiles((previous) => [...previous, ...accepted.slice(0, Math.max(room, 0))]);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const nextErrors = validate(values, imageCount);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    let uploaded: string[] = [];
    try {
      uploaded = newFiles.length > 0 ? await uploadDonationImages(donorId, newFiles) : [];
      const payload = toPayload(values, [...keptImages, ...uploaded]);
      if (donation) {
        await updateDonation(donation.id, payload);
        const removed = donation.image_paths.filter((path) => !keptImages.includes(path));
        await removeDonationImages(removed);
        onSaved('Your donation was updated.');
      } else {
        await createDonation(payload);
        onSaved('Your donation is now live for NGOs to request.');
      }
    } catch (err) {
      await removeDonationImages(uploaded);
      setSubmitting(false);
      setError(errorMessage(err, 'We could not save the donation. Please try again.'));
      return;
    }
    setSubmitting(false);
  };

  return (
    <Modal
      open={open}
      title={donation ? 'Edit donation' : 'Post a new donation'}
      onClose={() => !submitting && onClose()}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" form="donation-form" loading={submitting}>{donation ? 'Save changes' : 'Post donation'}</Button>
        </>
      }
    >
      <form id="donation-form" onSubmit={handleSubmit} noValidate className="space-y-6">
        <section className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Donation title" htmlFor="d-title" required error={errors.title}>
              <input id="d-title" className={inputClass} value={values.title} onChange={set('title')} placeholder="e.g. Winter jackets for children" />
            </Field>
          </div>
          <Field label="Category" htmlFor="d-category" required error={errors.category}>
            <select id="d-category" className={inputClass} value={values.category} onChange={set('category')}>
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Item condition" htmlFor="d-condition" required error={errors.item_condition}>
            <select id="d-condition" className={inputClass} value={values.item_condition} onChange={set('item_condition')}>
              <option value="">Select condition</option>
              {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Quantity" htmlFor="d-quantity" required error={errors.quantity}>
            <input id="d-quantity" type="number" min="0" step="any" className={inputClass} value={values.quantity} onChange={set('quantity')} />
          </Field>
          <Field label="Unit" htmlFor="d-unit" required error={errors.unit} hint="e.g. pieces, kg, boxes, meals">
            <input id="d-unit" className={inputClass} value={values.unit} onChange={set('unit')} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description" htmlFor="d-description" error={errors.description}>
              <textarea id="d-description" rows={3} className={inputClass} value={values.description} onChange={set('description')} />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <p className="text-sm font-bold text-neutral-800">Photos</p>
          <div className="flex flex-wrap gap-3">
            {keptImages.map((path) => (
              <Thumb key={path} src={donationImageUrl(path)} onRemove={() => setKeptImages((prev) => prev.filter((p) => p !== path))} />
            ))}
            {previews.map((preview) => (
              <Thumb
                key={preview.url}
                src={preview.url}
                onRemove={() => setNewFiles((prev) => prev.filter((f) => f !== preview.file))}
              />
            ))}
            {imageCount < MAX_DONATION_IMAGES && (
              <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary-200 bg-secondary-50 text-xs font-semibold text-primary-700 transition hover:border-primary-400">
                Add photo
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
              </label>
            )}
          </div>
          <p className="text-xs text-neutral-500">Up to {MAX_DONATION_IMAGES} JPG, PNG or WEBP images, 5 MB each.</p>
          {errors.images && <p className="text-xs font-medium text-error-600" role="alert">{errors.images}</p>}
        </section>

        <section className="grid gap-5 sm:grid-cols-2">
          <Field label="Pickup address" htmlFor="d-pickup" required error={errors.pickup_address}>
            <input id="d-pickup" className={inputClass} value={values.pickup_address} onChange={set('pickup_address')} />
          </Field>
          <Field label="City" htmlFor="d-city" required error={errors.city}>
            <input id="d-city" className={inputClass} value={values.city} onChange={set('city')} />
          </Field>
          <Field label="Contact information" htmlFor="d-contact" required error={errors.contact_info} hint="Phone or email shared with the accepting organization">
            <input id="d-contact" className={inputClass} value={values.contact_info} onChange={set('contact_info')} />
          </Field>
          <Field label="Available until" htmlFor="d-until" required error={errors.available_until}>
            <input id="d-until" type="datetime-local" className={inputClass} value={values.available_until} onChange={set('available_until')} />
          </Field>
        </section>

        <section className="space-y-4 rounded-2xl border border-secondary-200 bg-secondary-50/60 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-neutral-800">Pickup location</p>
              <p className="mt-1 text-xs text-neutral-600">Used to find NGOs within the notification radius. Food posts need a location.</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              loading={locating}
              onClick={() => {
                if (!navigator.geolocation) {
                  setLocationError('This browser cannot read your location. Enter the coordinates manually.');
                  return;
                }
                setLocating(true);
                setLocationError(null);
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    setValues((previous) => ({
                      ...previous,
                      latitude: position.coords.latitude.toFixed(6),
                      longitude: position.coords.longitude.toFixed(6),
                    }));
                    setLocating(false);
                  },
                  () => {
                    setLocationError('We could not read your location. Allow location access or enter the coordinates.');
                    setLocating(false);
                  },
                  { enableHighAccuracy: true, timeout: 10000 }
                );
              }}
            >
              Use my current location
            </Button>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Latitude" htmlFor="d-lat" error={errors.location}>
              <input id="d-lat" type="number" step="any" className={inputClass} value={values.latitude} onChange={set('latitude')} />
            </Field>
            <Field label="Longitude" htmlFor="d-lng">
              <input id="d-lng" type="number" step="any" className={inputClass} value={values.longitude} onChange={set('longitude')} />
            </Field>
          </div>
          {locationError && <Alert tone="warning">{locationError}</Alert>}
        </section>

        {isFood && (
          <section className="space-y-5 rounded-2xl border border-warning-100 bg-warning-50/50 p-5">
            <div>
              <p className="text-sm font-bold text-neutral-800">Food safety details</p>
              <p className="mt-1 text-xs text-neutral-600">Cooked food is never redistributed after its safe pickup deadline.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Preparation date and time" htmlFor="d-prepared" required error={errors.food_prepared_at}>
                <input id="d-prepared" type="datetime-local" className={inputClass} value={values.food_prepared_at} onChange={set('food_prepared_at')} />
              </Field>
              <Field label="Safe pickup deadline" htmlFor="d-deadline" required error={errors.safe_pickup_deadline}>
                <input id="d-deadline" type="datetime-local" className={inputClass} value={values.safe_pickup_deadline} onChange={set('safe_pickup_deadline')} />
              </Field>
              <Field label="Vegetarian or non-vegetarian" htmlFor="d-veg" required error={errors.food_veg_type}>
                <select id="d-veg" className={inputClass} value={values.food_veg_type} onChange={set('food_veg_type')}>
                  <option value="">Select</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="non_vegetarian">Non-vegetarian</option>
                </select>
              </Field>
              <Field label="Storage conditions" htmlFor="d-storage" hint="e.g. kept hot, refrigerated at 4 C">
                <input id="d-storage" className={inputClass} value={values.food_storage_conditions} onChange={set('food_storage_conditions')} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Allergen information" htmlFor="d-allergen" hint="List nuts, dairy, gluten or none">
                  <input id="d-allergen" className={inputClass} value={values.food_allergen_info} onChange={set('food_allergen_info')} />
                </Field>
              </div>
            </div>
            {values.safe_pickup_deadline && isPast(new Date(values.safe_pickup_deadline).toISOString()) && (
              <Alert tone="warning">This deadline has already passed.</Alert>
            )}
          </section>
        )}

        {error && <Alert tone="error">{error}</Alert>}
      </form>
    </Modal>
  );
}

function Thumb({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div className="relative h-24 w-24 overflow-hidden rounded-xl ring-1 ring-neutral-200">
      <img src={src} alt="" className="h-full w-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove photo"
        className="absolute right-1 top-1 rounded-full bg-neutral-900/70 p-1 text-white transition hover:bg-neutral-900"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
