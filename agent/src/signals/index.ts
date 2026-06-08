import type { Signal, SignalBundle } from "@turing-arena/shared";
import { alloraSignal } from "./allora";
import { elfaSignal } from "./elfa";
import { limitlessSignal } from "./limitless";
import { mantleOnchainSignal } from "./mantleOnchain";
import { nansenSignal } from "./nansen";
import { surfSignal } from "./surf";

export { alloraSignal, nansenSignal, elfaSignal, surfSignal, mantleOnchainSignal, limitlessSignal };

/// Fan out to every signal source in parallel; tolerate individual failures.
export async function gatherSignals(asset: string, seed?: string | number): Promise<SignalBundle> {
  const tasks = [
    alloraSignal(asset, seed),
    nansenSignal(asset, seed),
    mantleOnchainSignal(asset, seed),
    elfaSignal(asset, seed),
    surfSignal(asset, seed),
    limitlessSignal(asset, seed),
  ];
  const settled = await Promise.allSettled(tasks);
  const signals: Signal[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") signals.push(r.value);
  }
  return { asset, signals, fetchedAt: Date.now() };
}
