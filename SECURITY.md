# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report it privately through GitHub's **[private vulnerability reporting](https://github.com/Younesfdj/gitfut/security/advisories/new)** (repo → **Security** → **Report a vulnerability**). If that isn't available, email **ferradjiyounes69@gmail.com**.

Please include:

- what the issue is and where (a URL, endpoint, or file),
- steps to reproduce, ideally a small proof of concept,
- the impact you believe it has.

You'll get an acknowledgement within **72 hours**, and I'll work to ship a fix as quickly as I can and keep you updated. Please give a reasonable window to patch before any public disclosure — I'm happy to credit you for the report.

## Scope

**In scope**

- the **gitfut.com** web app and its API routes,
- the source in this repository.

**Out of scope**

- issues that require a compromised GitHub account or a leaked token,
- rate-limiting / denial-of-service on the public GitHub-backed endpoints (they're best-effort by design),
- vulnerabilities in third-party dependencies with no working exploit against GitFut (please report those upstream),
- automated scanner output with no demonstrated impact.

**Note on private README embed keys (`?k=`):** these are GitFut-issued capability tokens, not GitHub credentials. A leaked `k` can expose a user's private-aware *card stats* (contribution-influenced ratings) via the public PNG URL until they rotate or revoke the key on the site. Report flaws in key handling / auth under in-scope API routes.

## Supported versions

GitFut is a continuously-deployed web app — only the currently deployed version (tracking `master`) is supported. There are no tagged releases to backport fixes to.

Thanks for helping keep scouts safe. 🛡️
