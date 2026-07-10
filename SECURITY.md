# Security Policy

## Supported Versions

Company Brain OS is currently in **private alpha**. Security fixes are applied
to the latest `main` / `develop` branches only.

| Version | Supported |
| ------- | --------- |
| `develop` | ✅ |
| `main` (tested only) | ✅ |
| older releases | ❌ |

## Threat Model

See [`docs/threat-model.md`](docs/threat-model.md) for the full threat model.
Key risks for this local-first tool:

- **Local data leakage**: uploaded transcripts, company documents, and the
  SQLite database live under `DATA_DIR` (default `./data`) and
  `.company-brain/`. These must never be committed (see `.gitignore`).
- **Prompt injection**: source documents are untrusted. Extraction wraps them
  as data and never treats document text as instructions.
- **Citation forgery**: the answer engine never trusts the model to invent
  `sourceId` / `chunkId` values; evidence is validated against retrieved records.
- **Stored XSS**: wiki Markdown is rendered with `rehype-raw` disabled; raw
  HTML is not interpreted.
- **Path traversal**: uploaded filenames are never used as storage paths.

## Reporting a Vulnerability

Do **not** open a public issue for security vulnerabilities.

- Email the maintainer directly, or
- Use GitHub's private vulnerability reporting on the repository.

Please include:

1. A description of the vulnerability and impact.
2. Steps to reproduce (or a proof of concept).
3. Affected version / commit.

We aim to acknowledge reports within 72 hours and provide a remediation plan
within 14 days for private-alpha users.

## Secrets Handling

- API keys are read from the environment (`.env.local`), never hardcoded.
- `.env.example` contains no real secrets.
- If a secret is ever committed by accident, rotate it immediately and rewrite
  history (`git filter-repo` / BFG) — a later "remove secrets" commit is not
  sufficient.
