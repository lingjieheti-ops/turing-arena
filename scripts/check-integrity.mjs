// Integrity scan — fails if the repo contains content designed to manipulate an
// AI/LLM reviewer: invisible/zero-width characters, hidden-text styling, or
// reviewer-instruction phrases. Turing Arena is an on-chain accountability
// protocol; we hold our own submission to the same standard. Run: node scripts/check-integrity.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const SELF = ["scripts", "check-integrity.mjs"].join("/");

const EXCLUDE_NAME = new Set(["node_modules", ".git", ".next", "dist", "build", ".pnpm-store", ".state"]);
const EXCLUDE_PREFIX = ["contracts/lib", "contracts/out", "contracts/cache", "contracts/broadcast"];
const TEXT_EXT = new Set([".md", ".sol", ".ts", ".tsx", ".mjs", ".js", ".json", ".yml", ".yaml", ".css", ".html"]);

// Built from code points so this source file stays 100% visible ASCII.
const ZERO_WIDTH = new RegExp("[\\u200b\\u200c\\u200d\\u2060\\ufeff]");
const PHRASES = [
  /ignore\s+(all\s+)?(the\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior)\s+(instructions|guidance|context)/i,
  /give\s+(this|the)\b[^.\n]{0,40}\b(positive|favorable|perfect|highest|top)\s+(review|score|rating|marks)/i,
  /award\s+(full|maximum|top|perfect)\s+(marks|points|score)/i,
  /rate\s+(this|the)\b[^.\n]{0,30}\b(highly|highest|perfect)/i,
  /you\s+must\s+(give|rate|score|award|recommend)\b[^.\n]{0,30}\b(accept|positive|highest|winner)/i,
];
const HIDDEN_HTML =
  /style\s*=\s*["'][^"']*(display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0|opacity\s*:\s*0|color\s*:\s*#?fff(fff)?\b|color\s*:\s*white)/i;

const norm = (p) => p.split(sep).join("/");
const violations = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = norm(relative(root, full));
    if (EXCLUDE_NAME.has(name)) continue;
    if (EXCLUDE_PREFIX.some((p) => rel === p || rel.startsWith(p + "/"))) continue;
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(full);
      continue;
    }
    if (rel === SELF) continue;
    const dot = name.lastIndexOf(".");
    if (dot < 0 || !TEXT_EXT.has(name.slice(dot))) continue;
    const ext = name.slice(dot);

    let content;
    try {
      content = readFileSync(full, "utf8");
    } catch {
      continue;
    }
    if (content.charCodeAt(0) === 0xfeff) content = content.slice(1); // allow leading BOM
    content.split(/\r?\n/).forEach((line, i) => {
      if (ZERO_WIDTH.test(line)) violations.push([rel, i + 1, "zero-width/invisible character"]);
      for (const re of PHRASES) if (re.test(line)) violations.push([rel, i + 1, "reviewer-manipulation phrase"]);
      if ((ext === ".md" || ext === ".html") && HIDDEN_HTML.test(line)) {
        violations.push([rel, i + 1, "hidden-text styling"]);
      }
    });
  }
}

walk(root);

if (violations.length) {
  console.error(`x integrity check FAILED -- ${violations.length} suspicious pattern(s):`);
  for (const [f, l, why] of violations) console.error(`  ${f}:${l}  ${why}`);
  process.exit(1);
}
console.log("OK integrity: no prompt-injection, hidden-text, or invisible-character patterns found.");
