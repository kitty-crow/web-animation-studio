export type Profile = 'nes' | 'snes' | 'original';
export type Backend = 'auto' | 'webgpu' | 'wasm';
export type Palette = number[][];
export type Histogram = Map<number, number>;
export interface Frame { data: Uint8ClampedArray; delay: number }
export interface GifMeta { width: number; height: number; frames: number; duration: number; loop: number | null }
export interface Settings {
 profile: Profile; width: number; height: number; sampling: string; dither: number;
 stability: boolean; optimise: boolean; background: boolean; bgMethod: string;
 support: number; alpha: number; backend: Backend; repair: boolean;
 modelName?: string | null; runtimeNames?: string[];
}
export interface Progress { stage?: string; waiting?: boolean; note?: string; at?: number }
export interface PaletteContext { mapping: number[][]; errors: Float64Array[]; indices: Uint8Array[]; used: Set<number>; transparent: boolean }
export interface Done { type: 'done'; blob: Blob; palettes: Palette[]; colourCount: number; meta: GifMeta; transparent: boolean; removed: number; skipped: number; omitted: number; requantised?: number }
export type WorkerReply = Done | { type: 'info'; meta: GifMeta } | ({ type: 'progress'; phase: string; percent: number } & Progress) | { type: 'error' | 'runtime-diagnostic'; message: string };
export type WorkerRequest = { type: 'inspect'; buffer: ArrayBuffer } | { type: 'convert'; buffer: ArrayBuffer; settings: Settings; model: Uint8Array | null; runtimeFiles: File[] };
export const errorText = (error: unknown): string => error instanceof Error ? error.message : String(error);
