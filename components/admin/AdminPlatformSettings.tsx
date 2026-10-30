import { useEffect, useState } from 'react';
import { Settings2 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { LoadingState } from '@/components/ui/LoadingState';
import { RADIUS_OPTIONS_KM } from '@/lib/constants';
import { fetchPlatformSettings, updatePlatformSetting } from '@/lib/api/impact';
import { errorMessage } from '@/lib/format';
import type { PlatformSettings } from '@/lib/types';

const MIN_RESERVATION_MINUTES = 15;
const MAX_RESERVATION_MINUTES = 720;

const inputClass =
  'w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-800 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

export function AdminPlatformSettings() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [minutesInput, setMinutesInput] = useState('');
  const [saving, setSaving] = useState<keyof PlatformSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchPlatformSettings()
      .then((data) => {
        if (!active) return;
        setSettings(data);
        setMinutesInput(String(data.reservation_minutes));
      })
      .catch((err) => {
        if (active) setLoadError(errorMessage(err, 'Settings could not be loaded.'));
      });
    return () => {
      active = false;
    };
  }, []);

  const save = async (key: keyof PlatformSettings, value: number) => {
    setSaving(key);
    setError(null);
    setNotice(null);
    try {
      await updatePlatformSetting(key, value);
      setSettings((previous) => (previous ? { ...previous, [key]: value } : previous));
      setNotice(key === 'notification_radius_km' ? 'Notification radius updated.' : 'Reservation duration updated.');
    } catch (err) {
      setError(errorMessage(err, 'The setting could not be saved.'));
    } finally {
      setSaving(null);
    }
  };

  const saveMinutes = () => {
    const minutes = Number(minutesInput);
    if (!Number.isInteger(minutes) || minutes < MIN_RESERVATION_MINUTES || minutes > MAX_RESERVATION_MINUTES) {
      setError(`Enter a whole number of minutes between ${MIN_RESERVATION_MINUTES} and ${MAX_RESERVATION_MINUTES}.`);
      return;
    }
    void save('reservation_minutes', minutes);
  };

  if (loadError) return <Alert tone="error">{loadError}</Alert>;
  if (!settings) return <LoadingState label="Loading settings..." />;

  return (
    <section className="space-y-6 rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-card">
      <h3 className="flex items-center gap-2 text-lg font-bold text-neutral-800">
        <Settings2 className="h-5 w-5 text-primary-600" aria-hidden /> Platform settings
      </h3>

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      <div className="space-y-3">
        <p className="text-sm font-semibold text-neutral-800">Notification radius for NGO alerts</p>
        <p className="text-xs text-neutral-500">Organizations within this distance of a new food post are alerted.</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Notification radius">
          {RADIUS_OPTIONS_KM.map((km) => {
            const selected = settings.notification_radius_km === km;
            return (
              <button
                key={km}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={saving !== null}
                onClick={() => void save('notification_radius_km', km)}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
                  selected
                    ? 'border-primary-600 bg-primary-600 text-white'
                    : 'border-neutral-300 bg-white text-neutral-700 hover:border-primary-400'
                }`}
              >
                {km} km
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <Field
          label="Reservation duration (minutes)"
          htmlFor="reservation-minutes"
          hint={`Between ${MIN_RESERVATION_MINUTES} and ${MAX_RESERVATION_MINUTES} minutes. Applies to reservations made after the change. Expired reservations are released by the server.`}
        >
          <input
            id="reservation-minutes"
            type="number"
            min={MIN_RESERVATION_MINUTES}
            max={MAX_RESERVATION_MINUTES}
            className={inputClass}
            value={minutesInput}
            onChange={(event) => setMinutesInput(event.target.value)}
          />
        </Field>
        <div className="flex justify-end">
          <Button size="sm" loading={saving === 'reservation_minutes'} onClick={saveMinutes}>
            Save duration
          </Button>
        </div>
      </div>
    </section>
  );
}
