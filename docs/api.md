# AskU — API Contract (MVP)

Base URL: /api/v1  
Auth: session cookie after UT SSO login

---

## Auth
### GET /auth/login
Redirects to UT SSO (OIDC)

### GET /auth/callback
Handles OIDC callback, creates session, redirects to web app

### POST /auth/logout
Clears session cookie

### GET /me
Returns current user + course-scoped pseudonyms
Response 200:
{
  "user": { "id": "uuid", "roles": ["STUDENT"] },
  "courses": [
    {
      "course_id": "uuid",
      "code": "LTAT.05.006",
      "title": "Software Testing",
      "pseudonym": { "id": "uuid", "public_name": "Anonymous #123" }
    }
  ]
}

---

## Courses
### GET /courses
Returns courses where the current user is enrolled
Response 200:
[
  { "id": "uuid", "code": "LTAT.05.006", "title": "Software Testing", "semester": "2025F" }
]

---

## Threads (Questions)
### GET /courses/{course_id}/threads
Query params:
- q (optional string) search in title/body
- status (optional) OPEN|ANSWERED|CLOSED
- page, limit (optional)
Response 200:
[
  {
    "id": "uuid",
    "course_id": "uuid",
    "author": { "public_name": "Anonymous #123" },
    "title": "string",
    "body_preview": "string",
    "status": "OPEN",
    "created_at": "iso"
  }
]

### POST /courses/{course_id}/threads
Creates a thread in a course (author is current user's pseudonym for this course)
Request:
{
  "title": "string",
  "body": "string"
}
Response 201:
{
  "id": "uuid"
}

### GET /threads/{thread_id}
Response 200:
{
  "id": "uuid",
  "course_id": "uuid",
  "author": { "public_name": "Anonymous #123" },
  "title": "string",
  "body": "string",
  "status": "OPEN",
  "created_at": "iso"
}

---

## Comments (Answers)
### GET /threads/{thread_id}/comments
Response 200:
[
  {
    "id": "uuid",
    "thread_id": "uuid",
    "author": { "public_name": "Anonymous #456" },
    "body": "string",
    "created_at": "iso"
  }
]

### POST /threads/{thread_id}/comments
Request:
{
  "body": "string"
}
Response 201:
{
  "id": "uuid"
}

---

## Reports
### POST /reports
Report a thread or comment
Request:
{
  "target_type": "THREAD" | "COMMENT",
  "target_id": "uuid",
  "reason": "SPAM" | "HARASSMENT" | "OTHER",
  "details": "string (optional)"
}
Response 201:
{ "id": "uuid" }

### GET /moderation/queue
Role required: MODERATOR or ADMIN
Response 200:
[
  {
    "report_id": "uuid",
    "created_at": "iso",
    "reporter": { "public_name": "Anonymous #123" },
    "target_type": "THREAD",
    "target_id": "uuid",
    "reason": "SPAM",
    "status": "OPEN"
  }
]

### POST /moderation/actions
Role required: MODERATOR or ADMIN
Request:
{
  "report_id": "uuid (optional)",
  "action_type": "HIDE" | "DELETE",
  "target_type": "THREAD" | "COMMENT",
  "target_id": "uuid",
  "note": "string (optional)"
}
Response 201:
{ "id": "uuid" }

---

## Errors (common)
401 Unauthorized: not logged in  
403 Forbidden: not enough permissions  
404 Not Found: entity missing  
429 Too Many Requests: rate limit triggered
git add docs/api.md
