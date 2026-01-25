# AskU — MVP Scope 

## Goal
Build a working UT student engagement platform that enables asking course-related questions with verified anonymity, plus basic moderation and anti-abuse.

## MVP
### Authentication & identity
- UT SSO login (OIDC/OAuth)
- Session-based auth (secure cookies)
- Verified anonymity: internal user identity, public pseudonym

### Core product
- Course feed (threads list per course)
- Create thread/question (anonymous/pseudonym mode)
- Thread page: view + comments/answers

### Safety & moderation
- Report content (thread/comment)
- Moderation queue (list of reports)
- Moderation actions: hide, delete (minimum)
- Audit log for moderation actions (minimum)

### Anti-abuse
- Rate limiting for creating threads/comments (minimum rules)

## Not in MVP
- 1:1 private chats / DMs
- Complex trust score / smart engines
- “Perfect” analytics dashboard and many complex roles/permissions
- ML-based toxicity detection (optional future)

## Success criteria 
- A UT user can login and see their course feed
- A user can post anonymously (pseudonym) and comment
- A user can report content
- A moderator can view reports and hide/delete content
- Basic rate limits prevent obvious spam
- Demo-ready: stable local run + clear README
