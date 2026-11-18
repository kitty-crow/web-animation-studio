import type { Progress, WorkerReply } from '../types';
export const scope = self as unknown as DedicatedWorkerGlobalScope;
export function reply(message: WorkerReply): void { scope.postMessage(message); }
export function send(phase: string, percent: number, detail: Progress = {}): void {
 reply({ type: 'progress', phase, percent, at: Date.now(), ...detail });
}
