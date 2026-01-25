# AskU — Anti-abuse Rules (MVP)

## Goals
- Prevent spam and flooding.
- Reduce harassment escalation.
- Keep anonymous posting usable.

## Rate limits (server-side)
### Threads (create question)
- Max 3 threads per hour per user (course-scoped).
- Max 10 threads per day per user.

### Comments (answers)
- Max 10 comments per hour per user (course-scoped).
- Max 60 comments per day per user.

### Reports
- Max 5 reports per hour per user.

## New user restrictions
Definition: "new user" = account created less than 24 hours ago
- Threads: max 1 per hour, max 3 per day
- Comments: max 5 per hour, max 20 per day
- Reports: allowed, but capped as above

## Auto-hide threshold (optional MVP)
- If a thread/comment receives >= 3 reports from distinct users in the same course,
  it becomes temporarily hidden and goes to moderation queue.

## Enforcement behavior
- When a limit is hit: return HTTP 429 with a short message.
- All rate limit events are logged (aggregate, no public identifiers).

## Notes
- Exact numbers can be adjusted after pilot feedback.
