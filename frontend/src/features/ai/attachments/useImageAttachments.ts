import { useCallback, useState, type ClipboardEvent, type DragEvent } from 'react';

export const MAX_IMAGES = 4;
const MAX_SIDE = 1600;

/** A picture as a compact JPEG/PNG data URL, longest side at most 1600 px (keeps requests small and tokens low). */
export async function downscale(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = url; });
    const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * k);
    canvas.height = Math.round(img.height * k);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(file.type === 'image/png' && k === 1 && file.size < 1_500_000 ? 'image/png' : 'image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Images attached to a chat message: pick, paste (Ctrl+V a screenshot) or drop; up to 4, downsized in the browser. */
export function useImageAttachments() {
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const add = useCallback(async (files: Iterable<File> | null | undefined) => {
    const list = [...(files ?? [])].filter((f) => f.type.startsWith('image/'));
    if (!list.length) return;
    setError(null);
    try {
      const urls = await Promise.all(list.map(downscale));
      setImages((cur) => {
        const next = [...cur, ...urls];
        if (next.length > MAX_IMAGES) setError(`Up to ${MAX_IMAGES} images per message.`);
        return next.slice(0, MAX_IMAGES);
      });
    } catch {
      setError('That image could not be read.');
    }
  }, []);

  const onPaste = useCallback((e: ClipboardEvent) => {
    const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
    if (files.length) { e.preventDefault(); void add(files); }
  }, [add]);
  const onDrop = useCallback((e: DragEvent) => {
    if (![...e.dataTransfer.files].some((f) => f.type.startsWith('image/'))) return;
    e.preventDefault();
    void add(e.dataTransfer.files);
  }, [add]);
  const onDragOver = useCallback((e: DragEvent) => { if ([...e.dataTransfer.items].some((i) => i.type.startsWith('image/'))) e.preventDefault(); }, []);

  const remove = useCallback((i: number) => setImages((cur) => cur.filter((_, k) => k !== i)), []);
  const clear = useCallback(() => { setImages([]); setError(null); }, []);
  /** Hand over the images for sending and empty the tray. */
  const take = useCallback(() => { const out = images; setImages([]); setError(null); return out; }, [images]);

  return { images, error, add, remove, clear, take, dropProps: { onPaste, onDrop, onDragOver } };
}

export type ImageAttachments = ReturnType<typeof useImageAttachments>;
