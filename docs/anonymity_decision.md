# AskU — Anonymity Decision

## Model
Verified anonymity:
- Users authenticate via University of Tartu email address (OTP code sent to @ut.ee inbox).
- The platform stores the real email address internally (for moderation and de-anonymization purposes only).
- Publicly, posts show only a pseudonym chosen by the student (random or derived from their name).

## Identity choice (set at first login)
Students choose one of two display modes when they first log in:

**Anonymous (default, recommended)**
- A random pseudonym is generated, e.g. "BraveOwl472".
- The pseudonym is unique per course and rotates automatically every 24 hours.
- Rotation reduces the risk of accidental identity exposure over time.

**Real name**
- Display name is derived from the email address: jessenia.tsenkman@ut.ee → "Jessenia Tsenkman".
- No rotation — the name stays the same across sessions.
- The student is aware that other students will see their real name.

The choice can be changed at any time from the Profile page.

## Pseudonym scope
Chosen scope: **COURSE**

Meaning:
- A user has a separate pseudonym per course.
- The same user will have different pseudonyms in different courses.
- This prevents cross-course correlation of activity.

## What is visible to others
- Posts show: pseudonym, course, content, timestamps, reaction counts.
- No real email addresses, student IDs, or UT identifiers are visible to other students.

## De-anonymization
De-anonymization is allowed only in exceptional cases:
- Threats, harassment, doxxing, illegal content, or repeated severe abuse.
- Access is restricted to designated moderators only.
- Every de-anonymization action is recorded in an audit log with actor, timestamp, and reason.
- Students are informed of this policy in the platform's Info & Rules page.

## Data minimization
- Only the email address and session token are stored for authentication.
- No browsing patterns, IP addresses, or device fingerprints are stored beyond what the operating system logs by default.
- Evaluation logs (for research) are aggregated and do not include direct identifiers.
