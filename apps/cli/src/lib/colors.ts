// Minimal, dependency-free ANSI styling. Disabled automatically when not
// attached to a TTY or when NO_COLOR is set, per common CLI conventions.
const enabled = process.stdout.isTTY && !process.env.NO_COLOR;

function wrap(code: string) {
  return (s: string) => (enabled ? `\x1b[${code}m${s}\x1b[0m` : s);
}

export const color = {
  green: wrap("32"),
  red: wrap("31"),
  yellow: wrap("33"),
  cyan: wrap("36"),
  bold: wrap("1"),
  dim: wrap("2"),
};

export const symbols = {
  check: enabled ? "✓" : "OK",
  cross: enabled ? "✗" : "x",
  warn: enabled ? "⚠" : "!",
};
