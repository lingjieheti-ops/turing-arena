"use client";

import { useCallback, useEffect, useState } from "react";
import { BaseError, ContractFunctionRevertedError, type Hex, decodeErrorResult, parseEventLogs } from "viem";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import type { Phase, RoundUI } from "@/lib/arena";
import { publicClient } from "@/lib/client";
import {
  computeCommitHash,
  loadMyAgent,
  loadPending,
  randomSalt,
  rationaleHashOf,
  saveMyAgent,
  savePending,
} from "@/lib/commit";
import { deployment, explorerUrl, identityRegistryAbi, proofOfAlphaAbi, targetChain } from "@/lib/contracts";
import { ConnectButton } from "./ConnectButton";

type Dir = "UP" | "DOWN";

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";
const FAUCET_URL = "https://faucet.sepolia.mantle.xyz";

/// ProofOfAlpha's custom errors aren't in the call ABI, so we keep a tiny ABI of
/// just the error selectors to decode revert data into a friendly message.
const ERROR_ABI = [
  { type: "error", name: "AlreadyCommitted", inputs: [] },
  { type: "error", name: "CommitClosed", inputs: [] },
  { type: "error", name: "RevealClosed", inputs: [] },
  { type: "error", name: "AlreadyRevealed", inputs: [] },
  { type: "error", name: "NothingCommitted", inputs: [] },
  { type: "error", name: "BadConfidence", inputs: [] },
  { type: "error", name: "NotAgentController", inputs: [] },
  { type: "error", name: "BadStake", inputs: [] },
] as const;

const ERROR_TEXT: Record<string, string> = {
  AlreadyCommitted: "You already committed this round.",
  CommitClosed: "Commit window closed. Wait for the next round.",
  RevealClosed: "Reveal window closed.",
  AlreadyRevealed: "You already revealed.",
  NothingCommitted: "No commit to reveal.",
  BadConfidence: "Conviction must be 1–100.",
  NotAgentController: "This wallet doesn't control that agent.",
  BadStake: "This round needs a stake.",
};

/// Turn a thrown wallet/contract error into a short, human message.
function friendlyError(e: unknown): string {
  // User rejected in the wallet (MetaMask code 4001).
  const code = (e as { code?: number })?.code ?? (e as { cause?: { code?: number } })?.cause?.code;
  if (code === 4001) return "You rejected the transaction.";

  if (e instanceof BaseError) {
    // Decode a named custom error from the revert data.
    const revert = e.walk((err) => err instanceof ContractFunctionRevertedError) as
      | ContractFunctionRevertedError
      | undefined;
    if (revert) {
      let name: string | undefined = revert.data?.errorName;
      const raw: Hex | undefined = revert.raw ?? revert.signature;
      if (!name && raw) {
        try {
          name = decodeErrorResult({ abi: ERROR_ABI, data: raw }).errorName;
        } catch {
          /* not one of ours */
        }
      }
      if (name && ERROR_TEXT[name]) return ERROR_TEXT[name];
    }
    const msg = e.shortMessage || e.message;
    if (/insufficient funds/i.test(msg)) {
      return "Not enough MNT for gas. Grab some from the faucet (link below).";
    }
    if (/user rejected|rejected the request/i.test(msg)) return "You rejected the transaction.";
    return msg;
  }
  const m = (e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message;
  if (m && /insufficient funds/i.test(m)) return "Not enough MNT for gas. Grab some from the faucet (link below).";
  return m || "Something went wrong.";
}

export function PredictPanel({ round, phase: livePhase }: { round: RoundUI; phase?: Phase }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();

  // Live phase from the parent (per-second) when provided; else the round's snapshot.
  const phase: Phase = livePhase ?? round.phase;

  const [myAgent, setMyAgent] = useState<bigint | null>(null);
  const [dir, setDir] = useState<Dir>("UP");
  const [confidence, setConfidence] = useState(60);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" | "info"; href?: string } | null>(null);

  // On-chain truth for this (round, agent): is there a commit, and was it revealed?
  const [committed, setCommitted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  // Does THIS browser hold the salt/preimage needed to reveal?
  const [hasPreimage, setHasPreimage] = useState(false);

  useEffect(() => {
    setMyAgent(loadMyAgent());
  }, []);

  /// Reconcile predict state with the CHAIN (not just localStorage): read the
  /// entry for (round, agent) and derive committed/revealed from it. localStorage
  /// only tells us whether we still hold the salt to reveal.
  const reconcile = useCallback(async () => {
    if (!myAgent) {
      setCommitted(false);
      setRevealed(false);
      setHasPreimage(false);
      return;
    }
    setHasPreimage(Boolean(loadPending(round.id, myAgent)));
    try {
      const entry = (await publicClient.readContract({
        address: deployment.proofOfAlpha,
        abi: proofOfAlphaAbi,
        functionName: "getEntry",
        args: [round.id, myAgent],
      })) as { commitHash: Hex; revealed: boolean };
      setCommitted(entry.commitHash !== ZERO_HASH);
      setRevealed(Boolean(entry.revealed));
    } catch {
      // RPC hiccup: fall back to localStorage so the UI still progresses.
      setCommitted(Boolean(loadPending(round.id, myAgent)));
    }
  }, [round.id, myAgent]);

  useEffect(() => {
    reconcile();
  }, [reconcile]);

  const wrongChain = isConnected && chainId !== targetChain.id;
  const explorer = (h: string) => `${explorerUrl}/tx/${h}`;

  async function spawn() {
    setBusy(true);
    setMsg({ text: "Minting your ERC-8004 identity…", tone: "info" });
    try {
      const card = { name: note.trim() || `You-${address?.slice(2, 6)}`, kind: "HUMAN", model: "human" };
      const uri = `data:application/json,${encodeURIComponent(JSON.stringify(card))}`;
      const hash = await writeContractAsync({
        address: deployment.identityRegistry,
        abi: identityRegistryAbi,
        functionName: "register",
        args: [uri],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const logs = parseEventLogs({ abi: identityRegistryAbi, logs: receipt.logs, eventName: "Registered" });
      const id = logs[0]?.args?.agentId as bigint | undefined;
      if (id === undefined) throw new Error("could not read agentId");
      saveMyAgent(id);
      setMyAgent(id);
      setMsg({ text: `Agent #${id} is yours.`, tone: "ok", href: explorer(hash) });
    } catch (e) {
      setMsg({ text: friendlyError(e), tone: "err" });
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!myAgent) return;
    setBusy(true);
    setMsg({ text: "Sealing your prediction (commit)…", tone: "info" });
    try {
      const predictedBps = (dir === "UP" ? 1 : -1) * Math.max(1, confidence * 4);
      const rationale = note.trim() || `${dir} call @ ${confidence}% conviction`;
      const rationaleHash = rationaleHashOf(rationale);
      const salt = randomSalt();
      const commitHash = computeCommitHash(myAgent, predictedBps, confidence, rationaleHash, salt);
      savePending({
        roundId: round.id.toString(),
        agentId: myAgent.toString(),
        predictedBps,
        confidence,
        rationale,
        rationaleHash,
        salt,
      });
      const hash = await writeContractAsync({
        address: deployment.proofOfAlpha,
        abi: proofOfAlphaAbi,
        functionName: "commit",
        args: [round.id, myAgent, commitHash],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await reconcile();
      setMsg({ text: "Sealed on-chain. Reveal opens when the commit window closes.", tone: "ok", href: explorer(hash) });
    } catch (e) {
      setMsg({ text: friendlyError(e), tone: "err" });
    } finally {
      setBusy(false);
    }
  }

  async function reveal() {
    if (!myAgent) return;
    const p = loadPending(round.id, myAgent);
    if (!p) {
      setMsg({ text: "No saved commit in this browser to reveal.", tone: "err" });
      return;
    }
    setBusy(true);
    setMsg({ text: "Revealing your call…", tone: "info" });
    try {
      const hash = await writeContractAsync({
        address: deployment.proofOfAlpha,
        abi: proofOfAlphaAbi,
        functionName: "reveal",
        args: [round.id, myAgent, BigInt(p.predictedBps), p.confidence, p.rationaleHash, p.salt],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await reconcile();
      setMsg({ text: "Revealed. Your call is now on the record.", tone: "ok", href: explorer(hash) });
    } catch (e) {
      setMsg({ text: friendlyError(e), tone: "err" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-ink-700/60 bg-ink-900/50 p-4">
      <div className="mb-3 text-sm font-semibold text-white">Make your call</div>

      {!isConnected ? (
        <div className="space-y-2">
          <p className="text-xs text-muted">Connect a wallet on {targetChain.name} to enter the arena.</p>
          <ConnectButton />
          <a href={FAUCET_URL} target="_blank" rel="noreferrer" className="block text-xs text-mint hover:underline">
            Need test MNT for gas? Grab some from the faucet ↗
          </a>
        </div>
      ) : wrongChain ? (
        <div className="space-y-2">
          <p className="text-xs text-human">You&apos;re on the wrong network.</p>
          <ConnectButton />
        </div>
      ) : !myAgent ? (
        phase === "commit" ? (
          <div className="space-y-3">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Agent name (optional)"
              className="w-full rounded-lg border border-ink-600 bg-ink-800/60 px-3 py-2 text-sm text-white outline-none focus:border-mint/40"
            />
            <button className="btn-primary w-full" onClick={spawn} disabled={busy}>
              {busy ? "Spawning…" : "Spawn my agent (ERC-8004)"}
            </button>
            <a href={FAUCET_URL} target="_blank" rel="noreferrer" className="block text-xs text-mint hover:underline">
              Need test MNT for gas? Grab some from the faucet ↗
            </a>
          </div>
        ) : (
          <p className="text-xs text-muted">
            Spawn + commit opens when the next round&apos;s commit window is live.
          </p>
        )
      ) : committed && !revealed && !hasPreimage ? (
        // Committed on-chain, but this browser lacks the salt to reveal.
        <p className="text-xs text-human">
          This agent committed from another device. Without the saved salt this browser can&apos;t reveal it.
        </p>
      ) : phase === "commit" && !committed ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              className={`btn ${dir === "UP" ? "bg-up/20 text-up ring-1 ring-up/50" : "btn-ghost"}`}
              onClick={() => setDir("UP")}
            >
              ▲ UP
            </button>
            <button
              className={`btn ${dir === "DOWN" ? "bg-down/20 text-down ring-1 ring-down/50" : "btn-ghost"}`}
              onClick={() => setDir("DOWN")}
            >
              ▼ DOWN
            </button>
          </div>
          <div>
            <div className="flex justify-between text-xs text-muted">
              <span>Conviction</span>
              <span className="stat-num text-white">{confidence}</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
              className="w-full accent-mint"
            />
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why? (hashed on-chain as your rationale)"
            className="w-full rounded-lg border border-ink-600 bg-ink-800/60 px-3 py-2 text-sm text-white outline-none focus:border-mint/40"
          />
          <button className="btn-primary w-full" onClick={commit} disabled={busy}>
            {busy ? "Sealing…" : "🔒 Commit prediction"}
          </button>
        </div>
      ) : phase === "commit" && committed ? (
        <p className="text-xs text-mint">Committed. Come back after the commit window to reveal.</p>
      ) : phase === "reveal" && committed && !revealed ? (
        <button className="btn-primary w-full" onClick={reveal} disabled={busy}>
          {busy ? "Revealing…" : "🔓 Reveal my call"}
        </button>
      ) : phase === "reveal" && !committed ? (
        <p className="text-xs text-muted">You didn&apos;t commit this round, so reveal is closed for you.</p>
      ) : (
        <p className="text-xs text-muted">
          {revealed
            ? "Revealed. Awaiting settlement."
            : phase === "settled"
              ? "Round settled."
              : "Settling…"}
        </p>
      )}

      {msg ? (
        <div
          className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
            msg.tone === "ok"
              ? "border-mint/30 bg-mint/5 text-mint"
              : msg.tone === "err"
                ? "border-down/30 bg-down/5 text-down"
                : "border-ink-600 bg-ink-800/50 text-muted"
          }`}
        >
          {msg.text}{" "}
          {msg.href ? (
            <a href={msg.href} target="_blank" rel="noreferrer" className="underline">
              tx ↗
            </a>
          ) : null}
          {msg.tone === "err" && /faucet/i.test(msg.text) ? (
            <>
              {" "}
              <a href={FAUCET_URL} target="_blank" rel="noreferrer" className="underline">
                faucet ↗
              </a>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
