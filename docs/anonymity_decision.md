# AskU — Anonymity Decision

## Model
Verified anonymity:
- Users authenticate via UT SSO (OIDC).
- The platform stores the real UT-linked identity internally.
- Publicly, posts show only a pseudonym (e.g., "Anonymous #123").

## Pseudonym scope
Chosen scope: **COURSE**

Meaning:
- A user has a separate stable pseudonym per course.
- The same user will have different pseudonyms in different courses.

## What is visible to others
- Public feed shows: pseudonym, course, content, timestamps.
- No real names, emails, student IDs, or UT identifiers are visible.

## De-anonymization
De-anonymization is allowed only in exceptional cases:
- Threats, harassment, doxxing, illegal content, or repeated severe abuse.
- Access is restricted to Admin (and/or designated moderators).
- Every de-anonymization request/action must be recorded in an audit log.

## Data minimization
- Store only the minimum identity attributes needed for authentication and abuse handling.
- Logs for evaluation are aggregated and should not include direct identifiers.
