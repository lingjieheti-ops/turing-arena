// Regenerate src/abis.generated.ts from forge artifacts for guaranteed 1:1
// fidelity. Run after `forge build` in contracts/:  pnpm --filter @turing-arena/shared sync-abis
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../../../contracts/out");

const targets = {
  identityRegistryAbi: "IdentityRegistry.sol/IdentityRegistry.json",
  reputationRegistryAbi: "ReputationRegistry.sol/ReputationRegistry.json",
  proofOfAlphaAbi: "ProofOfAlpha.sol/ProofOfAlpha.json",
  reporterPriceOracleAbi: "ReporterPriceOracle.sol/ReporterPriceOracle.json",
};

let body = "// AUTO-GENERATED from forge artifacts by scripts/extract-abis.mjs. Do not edit.\n\n";
let ok = 0;
for (const [name, rel] of Object.entries(targets)) {
  const p = resolve(outDir, rel);
  if (!existsSync(p)) {
    console.warn(`! missing artifact: ${rel} (run \`forge build\` in contracts/)`);
    continue;
  }
  const art = JSON.parse(readFileSync(p, "utf8"));
  body += `export const ${name} = ${JSON.stringify(art.abi)} as const;\n\n`;
  ok++;
}

if (ok === 0) {
  console.error("No artifacts found. Run `forge build` in contracts/ first.");
  process.exit(1);
}

writeFileSync(resolve(here, "../src/abis.generated.ts"), body);
console.log(`✓ wrote ${ok} ABIs to src/abis.generated.ts`);
