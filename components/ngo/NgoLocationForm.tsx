import { useState, type FormEvent } from 'react';
import { MapPin } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { setOrganizationLocation } from '@/lib/api/donations';
import { errorMessage } from '@/lib/format';

interface NgoLocationFormProps {
  latitude: number | null;
  longitude: number | null;
  onSaved: () => void;
}

const inputClass =
  'w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-800 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

function isValidCoordinate(value: string, limit: number): boolean {
  if (value.trim() === '') return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= limit;
}

export function NgoLocationForm({ latitude, longitude, onSaved }: NgoLocationFormProps) {
  const [lat, setLat] = useState(latitude != null ? String(latitude) : '');
  const [lng, setLng] = useState(longitude != null ? String(longitude) : '');
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('This browser cannot read your location. Enter the coordinates manually.');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(6));
        setLng(position.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        setError('We could not read your location. Allow location access or enter the coordinates.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!isValidCoordinate(lat, 90) || !isValidCoordinate(lng, 180)) {
      setError('Enter a latitude between -90 and 90 and a longitude between -180 and 180.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await setOrganizationLocation(Number(lat), Number(lng));
      onSaved();
    } catch (err) {
      setError(errorMessage(err, 'Your location could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-5 rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary-100 text-primary-600">
            <MapPin className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="font-bold text-neutral-800">Your organization location</p>
            <p className="mt-1 text-sm text-neutral-600">
              Nearby donation alerts are measured from this point. Set it once so you hear about food close to you.
            </p>
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" loading={locating} onClick={useCurrentLocation}>
          Use my current location
        </Button>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Latitude" htmlFor="ngo-lat">
          <input id="ngo-lat" type="number" step="any" className={inputClass} value={lat} onChange={(e) => setLat(e.target.value)} />
        </Field>
        <Field label="Longitude" htmlFor="ngo-lng">
          <input id="ngo-lng" type="number" step="any" className={inputClass} value={lng} onChange={(e) => setLng(e.target.value)} />
        </Field>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex justify-end">
        <Button type="submit" loading={saving}>Save location</Button>
      </div>
    </form>
  );
}
