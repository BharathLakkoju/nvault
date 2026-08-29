Yes — this is actually a **very practical developer utility**, and the two-interface approach makes sense.

I’d frame the product as a **secure environment/configuration backup vault for developers**, rather than simply an `.env` file storage app.

## Core idea

You have projects like:

```text
project-a/
├── .env
├── .env.local
└── ...

project-b/
├── .env
└── ...

project-c/
├── config/
│   └── secrets.env
└── ...
```

Instead of keeping these files locally or manually copying them into password managers/cloud storage, the application lets you securely store them and retrieve them from anywhere.

The important part is:

> **The vault stores the actual files, not just environment variable values.**

That means formatting, comments, multiline values, quotes, ordering, etc. are preserved exactly.

---

# 1. Web Application

The web UI is the normal interface.

### Dashboard

```text
┌─────────────────────────────────────────────────────┐
│ EnvVault                              🔍  👤 Bharath │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Projects                              + New Project│
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ 🟢 Portfolio Analytics                        │  │
│  │    3 environment files                        │  │
│  │    Updated 2 hours ago                        │  │
│  │                                               │  │
│  │    [View] [Download]                          │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ 🔵 YouTube Transcriptor                       │  │
│  │    2 environment files                        │  │
│  │    Updated 3 days ago                         │  │
│  │                                               │  │
│  │    [View] [Download]                          │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

Each project could contain:

```text
Portfolio Analytics
│
├── .env
├── .env.local
├── .env.production
└── secrets.json
```

### Useful operations

* Upload file
* Download file
* Download all project files
* Replace/update file
* Delete file
* Rename file
* View metadata
* Create project
* Delete project
* Search projects
* Search files
* Version history
* Restore previous version
* Download project as ZIP

---

# 2. Terminal CLI

This is where I think your idea becomes much more interesting.

The CLI should **not require opening the web application**.

For example:

```bash
envvault login
```

Authentication could open a browser once:

```text
EnvVault CLI

Opening browser for authentication...

✓ Authentication successful

Logged in as bharath@example.com
```

Then on a server/WSL environment:

```bash
envvault projects
```

```text
Projects

1. portfolio-analytics
2. youtube-transcriptor
3. prompt-improver
4. jwt-decoder
```

Download a specific environment:

```bash
envvault pull portfolio-analytics .env
```

Result:

```text
Fetching portfolio-analytics/.env...

✓ Downloaded .env
```

Or:

```bash
envvault pull portfolio-analytics
```

would restore **all environment files**.

```text
portfolio-analytics/

✓ .env
✓ .env.local
✓ .env.production

3 files restored
```

---

# 3. The killer feature: `envvault init`

I'd make this one of the primary workflows.

Suppose you clone a project on a new machine:

```bash
git clone git@github.com:bharath/portfolio.git
cd portfolio
```

Normally:

```text
Where do I get .env from?
```

Instead:

```bash
envvault init
```

The CLI detects the project.

```text
Project detected:

  portfolio

Environment files available:

  ✓ .env
  ✓ .env.local

Restore them?

[Y/n]
```

Then:

```text
✓ .env
✓ .env.local

Environment restored successfully.
```

That's a **very compelling developer workflow**.

---

# 4. Automatic project identification

You could associate projects with a stable identifier rather than relying exclusively on their folder name.

For example:

```text
Project
├── ID: prj_7f82...
├── Name: portfolio-analytics
├── GitHub: github.com/bharath/portfolio
└── Files
    ├── .env
    └── .env.local
```

Then the CLI can inspect:

```bash
git remote -v
```

and identify:

```text
github.com/bharath/portfolio
```

as the corresponding EnvVault project.

So:

```bash
envvault init
```

could automatically find the correct vault.

---

# 5. CLI commands

I'd keep the initial CLI extremely small.

### Authentication

```bash
envvault login
envvault logout
envvault whoami
```

### Projects

```bash
envvault projects
envvault project create <name>
envvault project delete <name>
```

### Files

```bash
envvault push <project>
envvault pull <project>
envvault files <project>
envvault delete <project> <file>
```

### Local project workflow

```bash
envvault init
envvault status
envvault sync
```

Eventually:

```bash
envvault push
envvault pull
```

could automatically infer the project from the current directory.

---

# 6. I'd add `push` carefully

For example:

```bash
envvault push
```

Detect:

```text
Current project: portfolio-analytics

Detected:

.env
.env.local
.env.development
```

Then:

```text
⚠ These files contain sensitive credentials.

Upload:
  .env
  .env.local
  .env.development

Continue? [y/N]
```

This prevents accidental uploads.

---

# 7. Security is the MOST important part

This application will potentially contain:

```text
DATABASE_URL
API_KEY
AWS_ACCESS_KEY
JWT_SECRET
STRIPE_SECRET_KEY
OPENAI_API_KEY
```

So you **cannot treat it like normal file storage**.

The product's security architecture should be a major part of the project.

I'd design it around **zero-knowledge/client-side encryption**.

Conceptually:

```text
                 ┌──────────────────┐
                 │   Web / CLI      │
                 └────────┬─────────┘
                          │
                    Encrypt locally
                          │
                          ▼
                 ┌──────────────────┐
                 │ Encrypted Vault  │
                 └────────┬─────────┘
                          │
                          ▼
                    Object Storage
```

The server should ideally store:

```text
encrypted_file_blob
```

rather than:

```text
DATABASE_URL=postgres://...
OPENAI_API_KEY=...
```

---

# 8. Encryption model

For example:

```text
User
 │
 │ password/passkey
 ▼
Key derivation
 │
 ▼
Master encryption key
 │
 ├── Project key
 │     ├── .env
 │     ├── .env.local
 │     └── secrets.json
 │
 └── ...
```

Files are encrypted before being uploaded.

The backend sees something like:

```text
project_id: prj_123

filename: .env

encrypted_blob:
8f2a91c8c.......
```

not the actual secrets.

This gives the project a much stronger technical story.

---

# 9. Version history

This would be extremely useful.

Imagine:

```text
.env

Version 5   Aug 24, 2026
Version 4   Aug 18, 2026
Version 3   Aug 12, 2026
Version 2   Jul 30, 2026
Version 1   Jul 20, 2026
```

You could:

```bash
envvault history .env
```

```text
.env

v5   Aug 24   current
v4   Aug 18
v3   Aug 12
v2   Jul 30
v1   Jul 20
```

Then:

```bash
envvault restore .env --version 4
```

---

# 10. But don't expose secret values in the UI by default

The UI should show:

```text
.env

Filename       .env
Size           1.8 KB
Updated        2 hours ago
Versions      8
```

Not:

```text
DATABASE_URL=...
OPENAI_API_KEY=...
```

If you eventually support viewing contents, require an explicit action such as:

```text
👁 Reveal contents

⚠ This will expose secrets on your screen.
```

---

# 11. Useful `.gitignore` integration

Another excellent feature:

```bash
envvault init
```

could detect:

```text
.env
.env.local
```

and check `.gitignore`.

If missing:

```text
⚠ .env is not listed in .gitignore.

Add environment files to .gitignore?

[Y/n]
```

Then automatically add:

```gitignore
.env
.env.*
!.env.example
```

This turns the application into a small **developer security assistant**, rather than merely cloud storage.

---

# 12. Architecture I'd recommend

Given your existing stack preferences, I'd build it roughly like this:

```text
                    ┌───────────────────┐
                    │    Next.js Web    │
                    │   App Router      │
                    └─────────┬─────────┘
                              │
                              │ HTTPS
                              ▼
                    ┌───────────────────┐
                    │    API Server     │
                    │    NestJS         │
                    └───────┬───────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
          PostgreSQL      Redis       Object Storage
          metadata        sessions     encrypted files
```

CLI:

```text
envvault
   │
   ├── Auth
   ├── API Client
   ├── Encryption
   ├── Project Detection
   ├── File Manager
   └── Git Integration
```

---

# 13. Suggested stack

### Web

* Next.js
* TypeScript
* Tailwind
* shadcn/ui
* Zustand
* TanStack Query

### Backend

I'd use:

**NestJS + TypeScript**

because the application will have fairly well-defined domains:

```text
Auth
Users
Projects
Files
Versions
Encryption metadata
CLI tokens
Audit logs
```

### Database

**PostgreSQL + Prisma**

Tables roughly:

```text
users
projects
project_files
file_versions
cli_sessions
devices
audit_logs
```

### Storage

Encrypted blobs in something like:

```text
S3
Azure Blob Storage
Cloudflare R2
```

You don't want large file contents living directly inside PostgreSQL.

---

# 14. Authentication

For the web:

```text
Google
GitHub
Email / Password
Passkeys
```

For CLI:

```bash
envvault login
```

I'd use an OAuth/device authorization flow rather than asking users to type their password into the CLI.

Something like:

```text
$ envvault login

Open:
https://app.envvault.dev/device

Enter code:

X7KD-29PL

Waiting for authentication...

✓ Device authenticated
```

This works particularly well on:

* WSL
* SSH servers
* remote Linux machines
* Docker containers
* cloud VMs

---

# 15. A potentially even better CLI experience

Support:

```bash
envvault run
```

Example:

```bash
envvault run -- npm run dev
```

The CLI retrieves the encrypted environment and injects it **without writing `.env` to disk**.

Conceptually:

```text
EnvVault
   │
   ▼
decrypt
   │
   ▼
process environment
   │
   ▼
npm run dev
```

So:

```bash
envvault run -- npm run dev
```

could eventually become a major differentiator.

You could even support:

```bash
envvault exec -- python app.py
```

This would be especially useful on servers.

---

# 16. Another powerful feature: temporary environments

For example:

```bash
envvault run production -- npm start
```

The secrets exist only for the lifetime of the process.

That gives you:

```text
No .env file
No secret copied to disk
No manual setup
```

This starts moving the product toward a lightweight alternative to some secrets-management workflows.

---

# 17. MVP

I wouldn't build all of this initially.

### Phase 1 — Core

**Web**

* Authentication
* Projects
* Upload `.env`
* Download `.env`
* Delete
* Project/file metadata

**CLI**

```bash
envvault login
envvault projects
envvault push
envvault pull
envvault init
```

### Phase 2 — Security

* Client-side encryption
* Secure key management
* Device management
* Session revocation
* Audit logs
* MFA/passkeys

### Phase 3 — Developer experience

* Git repository detection
* `.gitignore` detection
* Version history
* Restore versions
* ZIP project download
* Environment diff

### Phase 4 — Advanced

```bash
envvault run -- npm run dev
```

* Secret injection
* Temporary environments
* Environment sharing
* Team projects
* Role-based access
* CI/CD integration

---

# 18. The product positioning

I wouldn't market it as:

> "Cloud storage for `.env` files."

That's too simple.

I'd position it closer to:

> **Your development environment, available anywhere.**

Or:

> **Securely backup and restore your project environments from anywhere.**

The core workflow becomes:

```text
                 YOUR PROJECT
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
     Local machine             EnvVault
                                  │
                       encrypted environment
                                  │
               ┌──────────────────┼─────────────────┐
               ▼                  ▼                 ▼
             Laptop              WSL              Server
               │                  │                 │
               └─────────── pull / init ────────────┘
```

And I think the **CLI + web combination is the right architectural decision**. The web app makes the product accessible and manageable, while the CLI makes it genuinely useful in real developer environments where opening a browser isn't convenient.

Most importantly, I'd make **`envvault init` + `envvault run`** the eventual signature features rather than stopping at upload/download.

---

# 19. Plans & billing

* **Free** — personal vault, capped at `FREE_LIMITS.maxPersonalProjects`
  projects. Full CLI + web, full version history, full zero-knowledge
  encryption.
* **Pro** ($10/mo, per user) — same as Free but **unlimited personal
  projects**. A per-user Polar subscription.
* **Team** — unlocks organizations (shared, zero-knowledge team projects).
  **One flat subscription per organization**, no per-seat charge, in three
  size tiers: Starter $29 (≤10 members), Growth $79 (≤25), Scale $199 (≤100).
  Owners move between tiers in-app; Polar prorates.

Both paid plans go through [Polar](https://polar.sh) as Merchant of Record,
so global sales tax / VAT and card handling are Polar's responsibility, not
ours. No card data ever reaches nvault.

Flow: creating an org makes it `PENDING_PAYMENT` and redirects to a
Polar-hosted checkout; the `subscription.active` webhook activates it. A
lapsed subscription makes the org **read-only** (`SUSPENDED`) — data is
never deleted for non-payment. Abandoned unpaid orgs are purged after 7
days. The paywall is enforced server-side in the authorization layer and is
disabled automatically when Polar isn't configured (local dev / self-host).

