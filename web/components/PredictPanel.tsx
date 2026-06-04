"use client";

import { useCallback, useEffect, useState } from "react";
import { BaseError, ContractFunctionRevertedError, type Hex, decodeErrorResult, parseEventLogs } from "viem";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import { decodeAgentCard } from "@/lib/agentCard";
import type { Phase, RoundUI } from "@/lib/arena";
import { publicClient } from "@/lib/client";
import {
  clearMyAgent,
  computeCommitHash,
  loadMyAgent,
  loadPending,
  randomSalt,
  rationaleHashOf,
  saveMyAgent,
  savePending,
} from "@/lib/commit";
import { deployment, explorerUrl, identityRegistryAbi, proofOfAlphaAbi, targetChain } from "@/lib/contracts";
import { type AgentCall, STRATEGIES, type Strategy, computeCall, fetchMomentum, strategyById } from "@/lib/strategy";
import { ConnectButton } from "./ConnectButton";

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";
const FAUCET_URL = "https://faucet.sepolia.mantle.xyz";

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
  AlreadyCommitted: "Your agent already called this round.",
  CommitClosed: "Commit window closed. Catch the next round.",
  RevealClosed: "Reveal window closed.",
  AlreadyRevealed: "Already revealed.",
  NothingCommitted: "No sealed call to reveal.",
  BadConfidence: "Conviction must be 1-100.",
  NotAgentController: "This wallet doesn't control that agent.",
  BadStake: "This round needs a stake.",
};

function friendlyError(e: unknown): string {
  const code = (e as { code?: number })?.code ?? (e as { cause?: { code?: number } })?.cause?.code;
  if (code === 4001) return "You rejected the transaction.";
  if (e instanceof BaseError) {
    const revert = e.walk((err) => err instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | undefined;
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
    if (/insufficient funds/i.test(msg)) return "Not enough MNT for gas. Grab some from the faucet (link below).";
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
  const phase: Phase = livePhase ?? round.phase;

  const [myAgent, setMyAgent] = useState<bigint | null>(null);
  const [agentName, setAgentName] = useState<string>("");
  const [strategy, setStrategy] = useState<Strategy | null>(null);

  // Deploy form
  const [deployName, setDeployName] = useState("");
  const [deployStrat, setDeployStrat] = useState<Strategy>(STRATEGIES[2]);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" | "info"; href?: string } | null>(null);

  const [committed, setCommitted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [hasPreimage, setHasPreimage] = useState(false);
  const [call, setCall] = useState<AgentCall | null>(null);

  // Load my agent + its on-chain card (name + strategy) so it can make calls.
  useEffect(() => {
    const id = loadMyAgent();
    setMyAgent(id);
    if (!id) return;
    publicClient
      .readContract({ address: deployment.identityRegistry, abi: identityRegistryAbi, functionName: "agentURI", args: [id] })
      .then((uri) => {
        const c = decodeAgentCard(uri as string) as { name?: string; strategy?: string };
        setAgentName(c.name || `Agent #${id}`);
        setStrategy(strategyById(c.strategy));
      })
      .catch(() => setStrategy(strategyById(undefined)));
  }, []);

  // Reconcile commit/reveal state with the chain (not just localStorage).
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
      setCommitted(Boolean(loadPending(round.id, myAgent)));
    }
  }, [round.id, myAgent]);

  useEffect(() => {
    reconcile();
  }, [reconcile]);

  // When a round is open and we haven't committed, let the agent compute its call.
  useEffect(() => {
    if (phase !== "commit" || committed || !strategy) return;
    let alive = true;
    fetchMomentum().then((m) => {
      if (alive) setCall(computeCall(strategy, m));
    });
    return () => {
      alive = false;
    };
  }, [phase, committed, strategy, round.id]);

  const wrongChain = isConnected && chainId !== targetChain.id;
  const explorer = (h: string) => `${explorerUrl}/tx/${h}`;

  async function deploy() {
    setBusy(true);
    setMsg({ text: "Deploying your agent (ERC-8004)…", tone: "info" });
    try {
      const name = deployName.trim() || `Agent-${address?.slice(2, 6)}`;
      const card = {
        name,
        kind: "AI",
        model: deployStrat.label,
        strategy: deployStrat.id,
        protocol: "erc-8004",
        skill: "proof-of-alpha",
      };
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
      setAgentName(name);
      setStrategy(deployStrat);
      setMsg({ text: `${name} is live as agent #${id}. It trades for you now.`, tone: "ok", href: explorer(hash) });
    } catch (e) {
      setMsg({ text: friendlyError(e), tone: "err" });
    } finally {
      setBusy(false);
    }
  }

  async function commitCall() {
    if (!myAgent || !call) return;
    setBusy(true);
    setMsg({ text: "Sealing your agent's call on-chain…", tone: "info" });
    try {
      const { predictedBps, confidence, rationale } = call;
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
      setMsg({ text: "Sealed. Your agent reveals when the commit window closes.", tone: "ok", href: explorer(hash) });
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
      setMsg({ text: "No saved call in this browser to reveal.", tone: "err" });
      return;
    }
    setBusy(true);
    setMsg({ text: "Revealing your agent's call…", tone: "info" });
    try {
      const hash = await writeContractAsync({
        address: deployment.proofOfAlpha,
        abi: proofOfAlphaAbi,
        functionName: "reveal",
        args: [round.id, myAgent, BigInt(p.predictedBps), p.confidence, p.rationaleHash, p.salt],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await reconcile();
      setMsg({ text: "Revealed. It's on your agent's record now.", tone: "ok", href: explorer(hash) });
    } catch (e) {
      setMsg({ text: friendlyError(e), tone: "err" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-ink-700/60 bg-ink-900/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-white">{myAgent ? "Your agent" : "Deploy your agent"}</div>
        {myAgent ? (
          <div className="flex items-center gap-2 text-xs text-muted">
            <span>
              {agentName} · <span className="text-ai">{strategy?.label ?? "agent"}</span>
            </span>
            <button
              onClick={() => {
                clearMyAgent();
                setMyAgent(null);
                setStrategy(null);
                setCall(null);
                setMsg(null);
              }}
              className="text-muted/70 underline hover:text-white"
            >
              new
            </button>
          </div>
        ) : null}
      </div>

      {!isConnected ? (
        <div className="space-y-2">
          <p className="text-xs text-muted">Connect a wallet on {targetChain.name} to deploy your agent.</p>
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
        <div className="space-y-3">
          <input
            value={deployName}
            onChange={(e) => setDeployName(e.target.value)}
            placeholder="Name your agent"
            className="w-full rounded-lg border border-ink-600 bg-ink-800/60 px-3 py-2 text-sm text-white outline-none focus:border-mint/40"
          />
          <div className="space-y-1.5">
            <div className="text-xs text-muted">Pick its strategy</div>
            {STRATEGIES.map((s) => (
              <button
                key={s.id}
                onClick={() => setDeployStrat(s)}
                className={`block w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                  deployStrat.id === s.id
                    ? "border-mint/50 bg-mint/10 text-white"
                    : "border-ink-700/60 bg-ink-900/40 text-ink-100/80 hover:border-ink-600"
                }`}
              >
                <span className="font-semibold">{s.label}</span>
                <span className="block text-xs text-muted">{s.blurb}</span>
              </button>
            ))}
          </div>
          <button className="btn-primary w-full" onClick={deploy} disabled={busy}>
            {busy ? "Deploying…" : "Deploy agent (ERC-8004)"}
          </button>
          <a href={FAUCET_URL} target="_blank" rel="noreferrer" className="block text-xs text-mint hover:underline">
            Need test MNT for gas? Grab some from the faucet ↗
          </a>
        </div>
      ) : committed && !revealed && !hasPreimage ? (
        <p className="text-xs text-human">
          Your agent committed from another device. Without the saved salt this browser can&apos;t reveal it.
        </p>
      ) : phase === "commit" && !committed ? (
        <div className="space-y-3">
          {call ? (
            <div className="rounded-lg border border-ink-700/60 bg-ink-900/40 px-3 py-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Its call this round</span>
                <span className={`font-mono ${call.direction === "UP" ? "text-up" : "text-down"}`}>
                  {call.direction === "UP" ? "▲" : "▼"} {call.predictedBps >= 0 ? "+" : ""}
                  {call.predictedBps}bps @ {call.confidence}%
                </span>
              </div>
              <div className="mt-1 text-xs text-ink-100/60">{call.rationale}</div>
            </div>
          ) : (
            <div className="text-xs text-muted">Your agent is reading the market…</div>
          )}
          <button className="btn-primary w-full" onClick={commitCall} disabled={busy || !call}>
            {busy ? "Sealing…" : "🔒 Seal my agent's call"}
          </button>
          <p className="text-[11px] text-muted">
            The call is decided by your strategy and sealed on-chain. Reveal opens after the window.
          </p>
        </div>
      ) : phase === "commit" && committed ? (
        <p className="text-xs text-mint">Your agent&apos;s call is sealed. Come back after the window to reveal.</p>
      ) : phase === "reveal" && committed && !revealed ? (
        <button className="btn-primary w-full" onClick={reveal} disabled={busy}>
          {busy ? "Revealing…" : "🔓 Reveal my agent's call"}
        </button>
      ) : phase === "reveal" && !committed ? (
        <p className="text-xs text-muted">Your agent sat this round out.</p>
      ) : (
        <p className="text-xs text-muted">
          {revealed ? "Revealed. Awaiting settlement." : phase === "settled" ? "Round settled." : "Settling…"}
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
