import { fallback } from "viem";
import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { rpcUrls, targetChain } from "./contracts";

export const wagmiConfig = createConfig({
  chains: [targetChain],
  connectors: [injected()],
  transports: {
    // Fall back across endpoints so a rate-limited RPC doesn't blank the dApp.
    [targetChain.id]: fallback(rpcUrls.map((u) => http(u))),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
