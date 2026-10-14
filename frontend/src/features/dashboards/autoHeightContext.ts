import { createContext } from 'react';

/** Content-sized widgets report the pixels they need here (provided by WidgetGrid only while viewing). */
export const AutoHeightContext = createContext<((id: string, px: number) => void) | null>(null);
