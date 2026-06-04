const on = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const wrap = (code: number) => (s: string) => (on ? `\x1b[${code}m${s}\x1b[0m` : s);

export const c = {
  reset: (s: string) => s,
  bold: wrap(1),
  dim: wrap(2),
  red: wrap(31),
  green: wrap(32),
  yellow: wrap(33),
  blue: wrap(34),
  magenta: wrap(35),
  cyan: wrap(36),
  gray: wrap(90),
};

export function log(...a: unknown[]): void {
  console.log(...a);
}

export function hr(ch = "─", n = 66): void {
  console.log(c.gray(ch.repeat(n)));
}

export function banner(title: string): void {
  hr("═");
  console.log(c.bold(c.cyan(`  ${title}`)));
  hr("═");
}

export function pct(bps: number): string {
  const v = bps / 100;
  const s = `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
  return v >= 0 ? c.green(s) : c.red(s);
}
