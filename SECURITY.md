# Security Policy

## Supported versions

VELYXORA is under active development and has not yet published a formal,
tagged release. Security attention is currently focused on the **latest state of
the default branch**. Older commits, forks and unreleased snapshots are not
maintained.

| Version                | Supported |
| ---------------------- | --------- |
| Default branch (latest) | Yes       |
| Older commits / forks   | No        |

This table will be revised once tagged releases exist.

## Reporting a vulnerability

Please do **not** open a public GitHub Issue for security vulnerabilities.

Security reports should use the repository's available private vulnerability
reporting mechanism when enabled (GitHub's "Report a vulnerability" flow under
the repository's **Security** tab). If private vulnerability reporting is not
currently available, avoid disclosing details publicly and use any private
channel offered by the repository maintainer.

This project does not publish an unverified security email address.

## What to include

A useful report includes:

- a clear description of the issue and its impact;
- steps to reproduce, or a minimal proof of concept;
- the affected component (frontend, backend, API endpoint, engine, etc.);
- the environment (commit, OS, Node version, relevant configuration without
  secrets);
- any suggested mitigation, if known.

Please redact secrets, tokens, cookies, credentials and personal data from logs
or screenshots before sharing.

## Response expectations

VELYXORA is maintained on a best-effort, volunteer basis. Response and fix
timelines cannot be guaranteed. Reports are triaged as they are received, and
confirmed issues are addressed as capacity allows. Please allow a reasonable
amount of time before any public disclosure.

## Known security-sensitive operational tasks

- Infrastructure credentials (database URLs, peppers, tokens, keys) must stay
  **outside the repository** and only in local or platform-managed environment
  configuration.
- If a credential is suspected to have been exposed, rotate it promptly and
  review access logs. Rotation is an operational task performed by the
  maintainer, not by contributors.
- Never commit `.env` files, private keys (`.pem`, `.key`) or dumps. These are
  ignored by `.gitignore`.
- Treat `.env.example` as documentation only. It must never contain real values.

## Disclosure

Please give the maintainer a reasonable opportunity to investigate and fix a
reported issue before disclosing it publicly. Coordinated disclosure is
appreciated.
