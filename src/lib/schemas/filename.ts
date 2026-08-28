/**
 * Filename validation shared by the API (defense against path traversal /
 * zip-slip when persisting or extracting files) and both clients (so users
 * get the same rejection message locally instead of a round trip).
 */

const MAX_FILENAME_LENGTH = 255;

// No path separators, no NUL bytes, no leading/trailing whitespace tricks,
// no ".." traversal segments. Dotfiles (".env", ".env.local") are allowed —
// they are the primary use case.
const SAFE_FILENAME_RE = /^[A-Za-z0-9._-]+$/;

export class InvalidFilenameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidFilenameError";
  }
}

function containsControlCharacter(name: string): boolean {
  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Validates a filename intended to be stored/restored inside a project.
 * Throws {@link InvalidFilenameError} rather than silently rewriting the
 * name, so callers cannot accidentally persist a file under a different
 * name than the user thinks they uploaded.
 */
export function assertSafeFilename(name: string): string {
  if (typeof name !== "string" || name.length === 0) {
    throw new InvalidFilenameError("Filename must not be empty.");
  }
  if (name.length > MAX_FILENAME_LENGTH) {
    throw new InvalidFilenameError(`Filename must be at most ${MAX_FILENAME_LENGTH} characters.`);
  }
  if (name === "." || name === "..") {
    throw new InvalidFilenameError("Filename must not be '.' or '..'.");
  }
  if (name.includes("/") || name.includes("\\")) {
    throw new InvalidFilenameError("Filename must not contain path separators.");
  }
  if (name.includes("..")) {
    throw new InvalidFilenameError("Filename must not contain '..'.");
  }
  if (containsControlCharacter(name)) {
    throw new InvalidFilenameError("Filename must not contain control characters.");
  }
  if (!SAFE_FILENAME_RE.test(name)) {
    throw new InvalidFilenameError(
      "Filename may only contain letters, numbers, dots, hyphens, and underscores.",
    );
  }
  return name;
}

export function isSafeFilename(name: string): boolean {
  try {
    assertSafeFilename(name);
    return true;
  } catch {
    return false;
  }
}

const DOTENV_PATTERN = /^\.env(\..+)?$/i;

/** Used for UI badges only — never gates security decisions. */
export function isDotenvStyleFile(name: string): boolean {
  return DOTENV_PATTERN.test(name);
}
