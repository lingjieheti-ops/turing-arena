"use client";

import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { shortAddr } from "@turing-arena/shared";
import { targetChain } from "@/lib/contracts";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    return (
      <button className="btn-primary" onClick={() => connect({ connector: injected() })} disabled={isPending}>
        {isPending ? "Connecting…" : "Connect Wallet"}
      </button>
    );
  }
  if (chainId !== targetChain.id) {
    return (
      <button className="btn-ghost" onClick={() => switchChain({ chainId: targetChain.id })}>
        Switch to {targetChain.name}
      </button>
    );
  }
  return (
    <button className="btn-ghost" onClick={() => disconnect()} title={address}>
      <span className="h-2 w-2 rounded-full bg-mint" />
      {shortAddr(address)}
    </button>
  );
}
