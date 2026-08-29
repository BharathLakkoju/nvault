# nvault

Terminal CLI for [nvault](https://github.com/BharathLakkoju/nvault) — a
secure, zero-knowledge developer environment/configuration vault.

> Your development environment, available anywhere.

Store your `.env`, `.env.local`, `.env.production` and other config files
encrypted, organised by project, and restore them onto any machine — WSL,
SSH sessions, remote servers, CI — without a browser.

## Install

```bash
npm install -g @lbharath/nvault
# or run without installing:
npx @lbharath/nvault --help
```

The package is published as `@lbharath/nvault`; the installed command is
`nvault`. Requires Node.js ≥ 20.

## Authenticate

nvault is self-hosted, so point the CLI at your server and authenticate
with a **Personal Access Token** created in the web app under
**Settings → CLI Tokens**. Your account password is never typed into the
terminal.

```bash
nvault login --api-url https://vault.example.com --token evk_xxxxxxxx
```

Run `nvault login` with no flags for an interactive prompt. Credentials
are stored with owner-only permissions in:

| OS            | Path                                                   |
| ------------- | ------------------------------------------------------ |
| Linux / WSL   | `$XDG_CONFIG_HOME/nvault/credentials.json`           |
| macOS         | `~/Library/Application Support/nvault/credentials.json` |
| Windows       | `%APPDATA%\nvault\credentials.json`                  |

The vault passphrase (which derives your encryption key) is **never**
stored — every command that reads or writes file contents prompts for it,
for that command only.

### Non-interactive / CI

| Variable              | Purpose                                              |
| --------------------- | --------------------------------------------------- |
| `NVAULT_API_URL`    | Server URL (bare origin is fine)                     |
| `NVAULT_TOKEN`      | Personal Access Token (`evk_…`)                      |
| `NVAULT_PASSPHRASE` | Vault passphrase — feed from a secret store only     |

## Commands

```bash
nvault login [--api-url <url>] [--token <evk_…>]
nvault logout
nvault whoami

nvault projects                    # list your projects
nvault orgs                        # list organizations you belong to
nvault project create <name>
nvault project delete <name> [-y]

nvault init                        # detect this repo's project, restore its files
nvault status                      # compare local files to what's stored

nvault files [project]             # project auto-detected from the git remote
nvault push  [project] [file] [-y] # upload .env* (or one named file)
nvault pull  [project] [file] [-y] # download into the current directory
nvault delete <project> <file> [-y]

nvault history <file> [-p <project>]
nvault restore <file> <version> [-p <project>]

nvault run [project] -- <command>  # inject secrets into a child process, no file written
```

`push` and `pull` auto-detect the project from the current directory's git
remote (`origin`). Pass a project name explicitly when there's no match.

### Plans

The free tier allows a handful of personal projects; `nvault project create`
returns a clear error once you hit the cap. Upgrade to **Pro** (unlimited
personal projects) or create an **organization** (shared team projects,
priced by size) from the web app — both are billed there, not in the CLI.

`nvault orgs` flags any organization whose subscription is `payment pending`
or `inactive`; a `push` to a project in an inactive org fails with a message
to renew, while `pull` still works (reads stay available on a lapsed
subscription).

## Safety

- `pull` backs up any existing local file (`<name>.bak.<timestamp>`) before
  overwriting, and skips files that are already identical.
- `push` refuses to upload in a non-interactive shell without `-y`, and
  always warns that the files contain credentials.
- File bytes are preserved exactly — comments, quoting, ordering,
  whitespace, multiline values. nvault stores files, it does not parse
  and rebuild them.

## Security model

Encryption happens entirely client-side (AES-256-GCM, envelope-wrapped
under a key derived from your vault passphrase via PBKDF2). The server only
ever sees ciphertext. A Personal Access Token authenticates API calls; it
does not, on its own, decrypt anything.

Revoke a lost token immediately from **Settings → CLI Tokens** in the web
app — it takes effect on the next request.

## License

MIT
