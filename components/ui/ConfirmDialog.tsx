import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  tone = 'primary',
  loading = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={() => !loading && onCancel()}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={loading}>Keep it</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-neutral-600">{message}</p>
        {error && <Alert tone="error">{error}</Alert>}
      </div>
    </Modal>
  );
}
