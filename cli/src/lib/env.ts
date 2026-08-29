/**
 * CLI environment variables. The canonical prefix is `NVAULT_`; the legacy
 * `ENVVAULT_` prefix (pre-rename) is still honoured as a fallback so existing
 * CI configs keep working. Prefer the new names in docs and new setups.
 */
function read(name: string): string | undefined {
  return process.env[`NVAULT_${name}`] ?? process.env[`ENVVAULT_${name}`];
}

export const envConfig = {
  token: () => read("TOKEN"),
  apiUrl: () => read("API_URL"),
  passphrase: () => read("PASSPHRASE"),
};
