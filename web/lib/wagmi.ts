import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { rpcUrl, targetChain } from "./contracts";

export const wagmiConfig = createConfig({
  chains: [targetChain],
  connectors: [injected()],
  transports: {
    [targetChain.id]: http(rpcUrl),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
