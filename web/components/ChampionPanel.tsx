"use client";

import { useEffect, useState } from "react";
import { type Address, formatUnits, parseAbiItem } from "viem";
import { publicClient } from "@/lib/client";
import { championVaultAbi, deployment, explorerUrl, hasChampionVault } from "@/lib/contracts";
import { SectionTitle, StatBox } from "./ui";

const TRADE_EVENT = parseAbiItem(
  "event ChampionTradeExecuted(uint256 indexed roundId, uint256 indexed agentId, bool long, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)",
);

interface Trade {
  roundId: bigint;
  agentId: bigint;
  long: boolean;
  amountIn: bigint;
  amountOut: bigint;
  txHash: string;
}

export function ChampionPanel() {
  const [holdings, setHoldings] = useState<{ base: bigint; quote: bigint } | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    if (!hasChampionVault()) return;
    const vault = deployment.championVault as Address;
    let alive = true;

    const load = async () => {
      try {
        const h = (await publicClient.readContract({
          address: vault,
          abi: championVaultAbi,
          functionName: "holdings",
        })) as readonly [bigint, bigint];
        if (alive) setHoldings({ base: h[0], quote: h[1] });
      } catch {
        /* ignore */
      }
      try {
        const latest = await publicClient.getBlockNumber();
        const fromBlock = latest > 100_000n ? latest - 100_000n : 0n;
        const logs = await publicClient.getLogs({ address: vault, event: TRADE_EVENT, fromBlock, toBlock: "latest" });
        if (alive) {
          setTrades(
            logs
              .slice(-5)
              .reverse()
              .map((l) => ({
                roundId: l.args.roundId as bigint,
                agentId: l.args.agentId as bigint,
                long: l.args.long as boolean,
                amountIn: l.args.amountIn as bigint,
                amountOut: l.args.amountOut as bigint,
                txHash: l.transactionHash,
              })),
          );
        }
      } catch {
        /* RPC may cap getLogs; holdings still render */
      }
    };
    load();
    const t = setInterval(load, 20000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <section id="champion" className="py-8">
      <SectionTitle
        kicker="Real Mantle DeFi"
        title="Champion copy-trade"
        right={<span className="badge border-mint/40 bg-mint/10 text-mint">Merchant Moe</span>}
      />
      <div className="panel p-5">
        <p className="max-w-2xl text-sm text-ink-100/75">
          When a round settles, the protocol routes incentive capital into a{" "}
          <span className="text-white">real Merchant Moe swap</span> following the on-chain{" "}
          <span className="text-mint">verified champion&apos;s</span> direction — long buys mETH, short sells it.
          Verified alpha doesn&apos;t just score points; it moves real Mantle liquidity.
        </p>

        {!hasChampionVault() ? (
          <div className="mt-4 rounded-xl border border-ink-700/60 bg-ink-900/50 px-4 py-3 text-sm text-muted">
            Deploy the DeFi layer (<code className="rounded bg-ink-800 px-1.5 py-0.5 text-mint">DeployDefi</code> /{" "}
            <code className="rounded bg-ink-800 px-1.5 py-0.5 text-mint">DeployDefiMock</code>) and set{" "}
            <code className="rounded bg-ink-800 px-1.5 py-0.5">NEXT_PUBLIC_CHAMPION_VAULT_ADDRESS</code> to light this up.
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatBox label="Champion portfolio · mETH" value={holdings ? Number(formatUnits(holdings.base, 18)).toFixed(4) : "—"} />
              <StatBox label="Champion portfolio · USDY" value={holdings ? Number(formatUnits(holdings.quote, 18)).toFixed(2) : "—"} />
              <StatBox label="Copy-trades" value={trades.length} />
            </div>
            <div className="mt-4 space-y-2">
              {trades.length === 0 ? (
                <div className="text-sm text-muted">No copy-trades yet — settle a round with a winner.</div>
              ) : (
                trades.map((t) => (
                  <a
                    key={t.txHash}
                    href={`${explorerUrl}/tx/${t.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-lg border border-ink-700/60 bg-ink-900/40 px-3 py-2 text-sm hover:border-mint/30"
                  >
                    <span>
                      Round #{t.roundId.toString()} · champion #{t.agentId.toString()} went{" "}
                      <span className={t.long ? "text-up" : "text-down"}>{t.long ? "LONG" : "SHORT"}</span>
                    </span>
                    <span className="stat-num text-xs text-muted">swap on Merchant Moe ↗</span>
                  </a>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
