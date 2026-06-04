"use client";

import { useEffect, useState } from "react";
import { parseEventLogs } from "viem";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import type { RoundUI } from "@/lib/arena";
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

export function PredictPanel({ round }: { round: RoundUI }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();

  const [myAgent, setMyAgent] = useState<bigint | null>(null);
  const [dir, setDir] = useState<Dir>("UP");
  const [confidence, setConfidence] = useState(60);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" | "info"; href?: string } | null>(null);
  const [committed, setCommitted] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const a = loadMyAgent();
    setMyAgent(a);
    if (a) setCommitted(Boolean(loadPending(round.id, a)));
  }, [round.id]);

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
    } catch (e: any) {
      setMsg({ text: e?.shortMessage || e?.message || "failed", tone: "err" });
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
      setCommitted(true);
      setMsg({ text: "Sealed on-chain. Reveal opens when the commit window closes.", tone: "ok", href: explorer(hash) });
    } catch (e: any) {
      setMsg({ text: e?.shortMessage || e?.message || "failed", tone: "err" });
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
      setRevealed(true);
      setMsg({ text: "Revealed. Your call is now on the record.", tone: "ok", href: explorer(hash) });
    } catch (e: any) {
      setMsg({ text: e?.shortMessage || e?.message || "failed", tone: "err" });
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
          <a
            href="https://faucet.sepolia.mantle.xyz"
            target="_blank"
            rel="noreferrer"
            className="block text-xs text-mint hover:underline"
          >
            Need test MNT for gas? Grab some from the faucet ↗
          </a>
        </div>
      ) : wrongChain ? (
        <p className="text-xs text-human">Switch to {targetChain.name} to play.</p>
      ) : !myAgent ? (
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
        </div>
      ) : round.phase === "commit" && !committed ? (
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
      ) : round.phase === "commit" && committed ? (
        <p className="text-xs text-mint">Committed. Come back after the commit window to reveal.</p>
      ) : round.phase === "reveal" && !revealed ? (
        <button className="btn-primary w-full" onClick={reveal} disabled={busy}>
          {busy ? "Revealing…" : "🔓 Reveal my call"}
        </button>
      ) : (
        <p className="text-xs text-muted">
          {revealed ? "Revealed — awaiting settlement." : round.phase === "settled" ? "Round settled." : "Settling…"}
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
        </div>
      ) : null}
    </div>
  );
}
