import type { ChartType } from '@/lib/types';
import type { Family } from './chartKinds';
import type { Opts } from './format';

/**
 * Every chart option, declared once. The options panel renders whatever applies to the chosen chart type,
 * so adding an option is one line here plus one read in the renderer.
 */
export type FieldKind = 'switch' | 'select' | 'number' | 'slider' | 'color' | 'text' | 'column';
export type Scope = ChartType | Family;

export interface Field {
  key: string;
  label: string;
  kind: FieldKind;
  options?: [string, string][];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  /** Show only for these chart types / families (omitted = every chart). */
  for?: Scope[];
  /** Show only while this holds for the current options. */
  when?: (o: Opts) => boolean;
}

export interface Section { id: string; label: string; fields: Field[] }
export interface Tab { id: string; label: string; sections: Section[] }

/** Bar / line / area / combo: drawn by CartesianChart, which implements every axis, scale and data option. */
export const STD: Scope[] = ['bar', 'line', 'area', 'composed'];
export const CART: Scope[] = ['cartesian'];
export const VISUAL: Scope[] = ['cartesian', 'part', 'radar'];
/** Options that prepare rows before drawing (aggregate, sort, top N): only renderers that use the shared preparation. */
export const PREPARED: Scope[] = [...STD, 'part', 'radar'];
export const sw = (key: string, label: string, f: Partial<Field> = {}): Field => ({ key, label, kind: 'switch', ...f });
export const sel = (key: string, label: string, options: [string, string][], f: Partial<Field> = {}): Field => ({ key, label, kind: 'select', options, ...f });
export const sld = (key: string, label: string, min: number, max: number, step = 1, f: Partial<Field> = {}): Field => ({ key, label, kind: 'slider', min, max, step, ...f });
export const txt = (key: string, label: string, f: Partial<Field> = {}): Field => ({ key, label, kind: 'text', ...f });
export const numf = (key: string, label: string, f: Partial<Field> = {}): Field => ({ key, label, kind: 'number', ...f });
export const col = (key: string, label: string, f: Partial<Field> = {}): Field => ({ key, label, kind: 'color', ...f });
/** A column of the chart's query result (dropdown). */
export const colf = (key: string, label: string, f: Partial<Field> = {}): Field => ({ key, label, kind: 'column', ...f });

