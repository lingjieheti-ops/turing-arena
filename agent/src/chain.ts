import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  http,
  keccak256,
  parseEventLogs,
  toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  type Decision,
  assetId,
  championVaultAbi,
  identityRegistryAbi,
  isConfigured,
  proofOfAlphaAbi,
  reporterPriceOracleAbi,
  toOraclePrice,
} from "@turing-arena/shared";
import { chain, cfg, hasWallet } from "./config";

export const publicClient = createPublicClient({ chain: chain(), transport: http(cfg.rpcUrl) });

export function getAccount() {
  if (!hasWallet()) throw new Error("PRIVATE_KEY missing/invalid. Set a 0x… 32-byte key in .env");
  return privateKeyToAccount(cfg.privateKey as Hex);
}

export function getWallet() {
  return createWalletClient({ account: getAccount(), chain: chain(), transport: http(cfg.rpcUrl) });
}

export function requireDeployed() {
  if (!isConfigured(cfg.addresses)) {
    throw new Error(
      "Contracts not configured. Deploy first (pnpm contracts:deploy:sepolia) and fill the *_ADDRESS vars in .env",
    );
  }
}

const POA = () => cfg.addresses.proofOfAlpha as Address;
const ID = () => cfg.addresses.identityRegistry as Address;
const ORACLE = () => cfg.addresses.priceOracle as Address;

// ----------------------------- commit hashing ----------------------------- //

export function rationaleHashOf(rationale: string): Hex {
  return keccak256(toBytes(rationale));
}

export function randomSalt(): Hex {
  return `0x${randomBytes(32).toString("hex")}` as Hex;
}

export function computeCommitHash(
  agentId: bigint,
  predictedBps: number,
  confidence: number,
  rationaleHash: Hex,
  salt: Hex,
): Hex {
  const encoded = encodeAbiParameters(
    [{ type: "uint256" }, { type: "int256" }, { type: "uint8" }, { type: "bytes32" }, { type: "bytes32" }] as const,
    [agentId, BigInt(predictedBps), confidence, rationaleHash, salt],
  );
  return keccak256(encoded);
}

// ------------------------------ commit state ------------------------------ //

interface CommitState {
  predictedBps: number;
  confidence: number;
  rationale: string;
  rationaleHash: Hex;
  salt: Hex;
}

function statePath(roundId: bigint, agentId: bigint): string {
  return join(cfg.stateDir, `round-${roundId}-agent-${agentId}.json`);
}
function saveCommitState(roundId: bigint, agentId: bigint, s: CommitState): void {
  mkdirSync(cfg.stateDir, { recursive: true });
  writeFileSync(statePath(roundId, agentId), JSON.stringify(s, null, 2));
}
function loadCommitState(roundId: bigint, agentId: bigint): CommitState | null {
  const p = statePath(roundId, agentId);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

// ------------------------------ identity --------------------------------- //

export interface AgentCardInput {
  name: string;
  kind: "AI" | "HUMAN";
  model?: string;
  signals?: string[];
}

function agentCardUri(card: AgentCardInput): string {
  const json = JSON.stringify({
    name: card.name,
    description: `Turing Arena ${card.kind} agent`,
    kind: card.kind,
    model: card.model,
    signals: card.signals,
    protocol: "erc-8004",
    skill: "proof-of-alpha",
  });
  return `data:application/json;base64,${Buffer.from(json).toString("base64")}`;
}

/// Mint an ERC-8004 identity owned by the operator wallet. Returns the agentId.
export async function registerAgent(card: AgentCardInput): Promise<bigint> {
  requireDeployed();
  const wallet = getWallet();
  const hash = await wallet.writeContract({
    address: ID(),
    abi: identityRegistryAbi,
    functionName: "register",
    args: [agentCardUri(card)],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const logs = parseEventLogs({ abi: identityRegistryAbi, logs: receipt.logs, eventName: "Registered" });
  const agentId = logs[0]?.args?.agentId as bigint | undefined;
  if (agentId === undefined) throw new Error("register: could not parse agentId from logs");
  return agentId;
}

// ------------------------------- oracle ---------------------------------- //

export async function reportPrice(symbol: string, price: number, source = "agent:manual"): Promise<Hex> {
  requireDeployed();
  const wallet = getWallet();
  return wallet.writeContract({
    address: ORACLE(),
    abi: reporterPriceOracleAbi,
    functionName: "reportPrice",
    args: [assetId(symbol), toOraclePrice(price), source],
  });
}

export async function readOraclePrice(symbol: string): Promise<bigint> {
  const [price] = (await publicClient.readContract({
    address: ORACLE(),
    abi: reporterPriceOracleAbi,
    functionName: "getPrice",
    args: [assetId(symbol)],
  })) as readonly [bigint, bigint];
  return price;
}

// -------------------------------- rounds --------------------------------- //

export async function openRound(symbol: string, title: string): Promise<bigint> {
  requireDeployed();
  const wallet = getWallet();
  const now = Math.floor(Date.now() / 1000);
  const commitDeadline = BigInt(now + cfg.windows.commit);
  const revealDeadline = commitDeadline + BigInt(cfg.windows.reveal);
  const settleTime = revealDeadline + BigInt(cfg.windows.settle);
  const hash = await wallet.writeContract({
    address: POA(),
    abi: proofOfAlphaAbi,
    functionName: "openRound",
    args: [assetId(symbol), ORACLE(), title, commitDeadline, revealDeadline, settleTime, 0n],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const logs = parseEventLogs({ abi: proofOfAlphaAbi, logs: receipt.logs, eventName: "RoundOpened" });
  const roundId = logs[0]?.args?.roundId as bigint | undefined;
  if (roundId === undefined) throw new Error("openRound: could not parse roundId");
  return roundId;
}

export async function roundCount(): Promise<bigint> {
  return (await publicClient.readContract({
    address: POA(),
    abi: proofOfAlphaAbi,
    functionName: "roundCount",
  })) as bigint;
}

export async function getRound(roundId: bigint) {
  return publicClient.readContract({
    address: POA(),
    abi: proofOfAlphaAbi,
    functionName: "getRound",
    args: [roundId],
  });
}

/// Find the most recent round still in its commit window.
export async function findOpenRound(): Promise<{ roundId: bigint; round: any } | null> {
  const count = await roundCount();
  const now = BigInt(Math.floor(Date.now() / 1000));
  for (let id = count; id >= 1n; id--) {
    const round: any = await getRound(id);
    if (!round.settled && now <= round.commitDeadline) return { roundId: id, round };
  }
  return null;
}

export async function commitDecision(roundId: bigint, agentId: bigint, decision: Decision): Promise<Hex> {
  requireDeployed();
  const wallet = getWallet();
  const rationaleHash = rationaleHashOf(decision.rationale);
  const salt = randomSalt();
  const commitHash = computeCommitHash(agentId, decision.predictedBps, decision.confidence, rationaleHash, salt);
  saveCommitState(roundId, agentId, {
    predictedBps: decision.predictedBps,
    confidence: decision.confidence,
    rationale: decision.rationale,
    rationaleHash,
    salt,
  });
  return wallet.writeContract({
    address: POA(),
    abi: proofOfAlphaAbi,
    functionName: "commit",
    args: [roundId, agentId, commitHash],
  });
}

export async function revealDecision(roundId: bigint, agentId: bigint): Promise<Hex> {
  requireDeployed();
  const state = loadCommitState(roundId, agentId);
  if (!state) throw new Error(`No saved commit for round ${roundId} agent ${agentId} (did this process commit it?)`);
  const wallet = getWallet();
  return wallet.writeContract({
    address: POA(),
    abi: proofOfAlphaAbi,
    functionName: "reveal",
    args: [roundId, agentId, BigInt(state.predictedBps), state.confidence, state.rationaleHash, state.salt],
  });
}

export async function settleRound(roundId: bigint, maxAgents = 200): Promise<Hex> {
  requireDeployed();
  const wallet = getWallet();
  return wallet.writeContract({
    address: POA(),
    abi: proofOfAlphaAbi,
    functionName: "settle",
    args: [roundId, BigInt(maxAgents)],
  });
}

export async function getAgentStats(agentId: bigint) {
  return publicClient.readContract({
    address: POA(),
    abi: proofOfAlphaAbi,
    functionName: "getAgentStats",
    args: [agentId],
  });
}

/// Copy-trade the verified champion of a settled round on Merchant Moe (ChampionVault).
export async function executeChampionTrade(roundId: bigint, amountIn: bigint, minOut: bigint): Promise<Hex> {
  const vault = cfg.addresses.championVault;
  if (!vault || vault === "0x0000000000000000000000000000000000000000") {
    throw new Error("CHAMPION_VAULT_ADDRESS not set — deploy the DeFi layer (DeployDefi / DeployDefiMock)");
  }
  const wallet = getWallet();
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  return wallet.writeContract({
    address: vault as Address,
    abi: championVaultAbi,
    functionName: "executeChampionTrade",
    args: [roundId, amountIn, minOut, deadline],
  });
}
