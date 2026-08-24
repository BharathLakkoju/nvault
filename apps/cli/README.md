# envvault

Terminal CLI for [EnvVault](https://github.com/BharathLakkoju/nvault) — a
zero-knowledge vault for `.env` and other project configuration files.
Encryption/decryption happens entirely on your machine; the server never
sees plaintext.

## Install

```bash
npm install -g @envvault/cli
```

Or grab a standalone binary (no Node.js required) from the
[latest release](https://github.com/BharathLakkoju/nvault/releases/latest) —
`envvault-linux-x64`, `envvault-macos-x64`, `envvault-macos-arm64`, or
`envvault-win-x64.exe`.

macOS/Linux via Homebrew:

```bash
brew tap BharathLakkoju/envvault
brew install envvault
```

## Usage

```bash
envvault login                        # opens your browser to authorize this device

envvault init                         # detects your project from the git remote,
                                       # offers to restore its environment files

envvault push                         # upload .env/.env.local/etc from the current directory
envvault pull                         # download them onto a new machine

envvault run -- npm run dev           # inject secrets into a child process — nothing
                                       # is ever written to disk
```

Run `envvault --help` or `envvault <command> --help` for the full reference.

By default the CLI talks to `http://localhost:4000/api/v1`. Point it at a
real deployment with:

```bash
export ENVVAULT_API_URL="https://api.your-envvault-deployment.com/api/v1"
```

See the [main repository](https://github.com/BharathLakkoju/nvault) for the web
app, API, and the full security model.
