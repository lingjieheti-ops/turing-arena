import { type NextRequest, NextResponse } from "next/server";
import { createPublicClient, fallback, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { deployment, identityRegistryAbi, rpcUrls, targetChain } from "@/lib/contracts";

// Signs an EIP-712 SetAgentWallet authorization so a user can delegate operation
// of their agent to the arena keeper in one transaction (auto-pilot). The keeper
// key lives only in this server env var and never reaches the client; only the
// signature is returned. Without the key configured the route 503s and the UI
// falls back to manual per-round calls.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const raw = process.env.KEEPER_PRIVATE_KEY;
  if (!raw) {
    return NextResponse.json({ error: "autopilot_unconfigured" }, { status: 503 });
  }

  let agentId: bigint;
  try {
    const body = (await req.json()) as { agentId?: string | number };
    agentId = BigInt(body.agentId ?? 0);
    if (agentId <= 0n) throw new Error("bad agentId");
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
    const account = privateKeyToAccount(key);
    const pub = createPublicClient({ chain: targetChain, transport: fallback(rpcUrls.map((u) => http(u))) });
    const nonce = (await pub.readContract({
      address: deployment.identityRegistry,
      abi: identityRegistryAbi,
      functionName: "walletNonce",
      args: [agentId],
    })) as bigint;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

    const signature = await account.signTypedData({
      domain: {
        name: "IdentityRegistry",
        version: "1",
        chainId: targetChain.id,
        verifyingContract: deployment.identityRegistry,
      },
      types: {
        SetAgentWallet: [
          { name: "agentId", type: "uint256" },
          { name: "newWallet", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      primaryType: "SetAgentWallet",
      message: { agentId, newWallet: account.address, nonce, deadline },
    });

    return NextResponse.json({ keeperWallet: account.address, deadline: deadline.toString(), signature });
  } catch (e) {
    return NextResponse.json({ error: "sign_failed", detail: (e as Error)?.message }, { status: 500 });
  }
}
