/**
 * CLI package version bump helpers (used locally and in GitHub Actions).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type BumpKind = "patch" | "minor" | "major";

/** Loose semver (no prerelease required for CLI releases). */
const SEMVER_CORE_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function isValidSemver(version: string): boolean {
  return SEMVER_CORE_RE.test(version.trim());
}

export function parseSemverCore(
  version: string,
): { major: number; minor: number; patch: number } {
  const trimmed = version.trim();
  const match = SEMVER_CORE_RE.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid semver (expected X.Y.Z): ${version}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/** Returns negative if a < b, 0 if equal, positive if a > b. */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemverCore(a);
  const pb = parseSemverCore(b);
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  return pa.patch - pb.patch;
}

export function bumpSemver(current: string, kind: BumpKind): string {
  const { major, minor, patch } = parseSemverCore(current);
  switch (kind) {
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "major":
      return `${major + 1}.0.0`;
    default:
      throw new Error(`Unknown bump kind: ${kind satisfies never}`);
  }
}

export function resolveNextVersion(options: {
  current: string;
  bump?: BumpKind;
  override?: string;
}): string {
  const current = options.current.trim();
  if (!isValidSemver(current)) {
    throw new Error(`Current version is not valid semver: ${current}`);
  }

  const override = options.override?.trim();
  if (override) {
    if (!isValidSemver(override)) {
      throw new Error(`Override version is not valid semver: ${override}`);
    }
    if (compareSemver(override, current) <= 0) {
      throw new Error(
        `Override version ${override} must be greater than current ${current}`,
      );
    }
    return override;
  }

  const bump = options.bump;
  if (!bump) {
    throw new Error("Either bump (patch|minor|major) or override version is required");
  }
  const next = bumpSemver(current, bump);
  if (compareSemver(next, current) <= 0) {
    throw new Error(`Bumped version ${next} must be greater than current ${current}`);
  }
  return next;
}

export function readPackageVersion(packageJsonPath: string): string {
  const raw = readFileSync(packageJsonPath, "utf8");
  const pkg = JSON.parse(raw) as { version?: string };
  if (!pkg.version || typeof pkg.version !== "string") {
    throw new Error(`Missing "version" in ${packageJsonPath}`);
  }
  return pkg.version;
}

export function writePackageVersion(
  packageJsonPath: string,
  nextVersion: string,
): void {
  const raw = readFileSync(packageJsonPath, "utf8");
  const pkg = JSON.parse(raw) as { version: string };
  pkg.version = nextVersion;
  const next = `${JSON.stringify(pkg, null, 2)}\n`;
  writeFileSync(packageJsonPath, next, "utf8");
}

function parseArgs(argv: string[]): {
  command: "resolve" | "apply";
  packagePath: string;
  bump?: BumpKind;
  override?: string;
  dryRun: boolean;
  current?: string;
} {
  const [, , command, ...rest] = argv;
  if (command !== "resolve" && command !== "apply") {
    throw new Error(
      "Usage: cli-bump-version.ts <resolve|apply> [--package path] [--current v] [--bump patch|minor|major] [--version v] [--dry-run]",
    );
  }

  let packagePath = "cli/package.json";
  let bump: BumpKind | undefined;
  let override: string | undefined;
  let dryRun = false;
  let current: string | undefined;

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--package" && rest[i + 1]) {
      packagePath = rest[++i];
    } else if (arg === "--current" && rest[i + 1]) {
      current = rest[++i];
    } else if (arg === "--bump" && rest[i + 1]) {
      const kind = rest[++i];
      if (kind !== "patch" && kind !== "minor" && kind !== "major") {
        throw new Error(`Invalid --bump: ${kind}`);
      }
      bump = kind;
    } else if (arg === "--version" && rest[i + 1]) {
      override = rest[++i];
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return {
    command,
    packagePath,
    bump,
    override,
    dryRun,
    current,
  };
}

function main(): void {
  const args = parseArgs(process.argv);
  const packagePath = resolve(process.cwd(), args.packagePath);
  const current =
    args.current ?? readPackageVersion(packagePath);
  const next = resolveNextVersion({
    current,
    bump: args.bump,
    override: args.override,
  });

  if (args.command === "resolve") {
    process.stdout.write(`${next}\n`);
    return;
  }

  if (args.dryRun) {
    process.stderr.write(
      `[dry-run] Would bump ${current} → ${next} in ${args.packagePath}\n`,
    );
    process.stdout.write(`${next}\n`);
    return;
  }

  writePackageVersion(packagePath, next);
  process.stdout.write(`${next}\n`);
}

const isMain =
  typeof process.argv[1] === "string" &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  try {
    main();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}
