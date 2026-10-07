/**
 * Home -> Ask transfer. The Ask page stays mounted once visited (KeepAlive), so a question is left here and the page is told
 * through an event; a first visit finds it on mount instead.
 */
export const ASK_EVENT = 'ask:incoming';
let pending: string | null = null;

export function sendToAsk(question: string): void {
  const q = question.trim();
  if (!q) return;
  pending = q;
  window.dispatchEvent(new Event(ASK_EVENT));
}

/** Take (and clear) the waiting question, if any. */
export function takePendingQuestion(): string | null {
  const q = pending;
  pending = null;
  return q;
}
