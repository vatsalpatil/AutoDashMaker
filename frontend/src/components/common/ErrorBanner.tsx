import { AlertCircle, X } from 'lucide-react';
import { Alert, AlertAction, AlertDescription } from '@/components/reui/alert';

/** Inline error message (ReUI Alert, destructive). Renders nothing when there is no message. */
export function ErrorBanner({ message, onDismiss }: { message: string | null; onDismiss?: () => void }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" role="alert">
      <AlertCircle />
      <AlertDescription className="text-destructive">{message}</AlertDescription>
      {onDismiss && (
        <AlertAction>
          <button type="button" onClick={onDismiss} aria-label="Dismiss" className="text-destructive/70 hover:text-destructive"><X className="size-4" /></button>
        </AlertAction>
      )}
    </Alert>
  );
}
