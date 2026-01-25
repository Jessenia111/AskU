# AskU — ERD (MVP)

## Entities (tables)

### users
Purpose: internal UT-authenticated identity (not public)
- id (uuid, pk)
- ut_subject (string, unique)  // OIDC "sub"
- email (string, nullable)
- created_at (timestamp)

### roles
Purpose: RBAC roles
- id (uuid, pk)
- name (string, unique) // STUDENT, STAFF, MODERATOR, ADMIN

### user_roles
Purpose: assign roles to users (global)
- user_id (uuid, fk -> users.id)
- role_id (uuid, fk -> roles.id)
- (pk: user_id, role_id)

### courses
Purpose: course space / context
- id (uuid, pk)
- code (string) // e.g. LTAT.05.006
- title (string)
- semester (string) // e.g. 2025F
- created_at (timestamp)

### enrollments
Purpose: which users belong to which courses
- user_id (uuid, fk -> users.id)
- course_id (uuid, fk -> courses.id)
- enrollment_role (string) // STUDENT or STAFF (optional)
- (pk: user_id, course_id)

### pseudonyms
Purpose: stable pseudonym per user per course (public identity)
- id (uuid, pk)
- user_id (uuid, fk -> users.id)
- course_id (uuid, fk -> courses.id)
- public_name (string) // "Anonymous #123"
- created_at (timestamp)
- unique(user_id, course_id)
- unique(course_id, public_name)

### threads
Purpose: questions/posts
- id (uuid, pk)
- course_id (uuid, fk -> courses.id)
- author_pseudonym_id (uuid, fk -> pseudonyms.id)
- title (string)
- body (text)
- status (string) // OPEN, ANSWERED, CLOSED (optional MVP)
- is_hidden (bool, default false)
- created_at (timestamp)

### comments
Purpose: answers/comments in a thread
- id (uuid, pk)
- thread_id (uuid, fk -> threads.id)
- author_pseudonym_id (uuid, fk -> pseudonyms.id)
- body (text)
- is_hidden (bool, default false)
- created_at (timestamp)

### reports
Purpose: user reports on content
- id (uuid, pk)
- reporter_pseudonym_id (uuid, fk -> pseudonyms.id)
- target_type (string) // THREAD or COMMENT
- target_id (uuid) // points to threads.id or comments.id
- reason (string) // SPAM, HARASSMENT, etc.
- details (text, nullable)
- status (string) // OPEN, REVIEWED, RESOLVED
- created_at (timestamp)

### moderation_actions
Purpose: actions taken by moderators/admins
- id (uuid, pk)
- report_id (uuid, fk -> reports.id, nullable)
- moderator_user_id (uuid, fk -> users.id)
- action_type (string) // HIDE, DELETE, WARN, MUTE (MVP: HIDE/DELETE)
- target_type (string) // THREAD or COMMENT
- target_id (uuid)
- note (text, nullable)
- created_at (timestamp)

### audit_log
Purpose: immutable log of sensitive operations (minimum)
- id (uuid, pk)
- actor_user_id (uuid, fk -> users.id)
- event_type (string) // MOD_ACTION, DEANON_REQUEST, DEANON_RESULT, LOGIN, etc.
- entity_type (string, nullable) // THREAD/COMMENT/REPORT
- entity_id (uuid, nullable)
- metadata_json (json, nullable)
- created_at (timestamp)

## Relationships (high level)
- users 1..* enrollments *..1 courses
- users 1..* pseudonyms *..1 courses (course-scoped)
- pseudonyms 1..* threads (author_pseudonym_id)
- pseudonyms 1..* comments (author_pseudonym_id)
- pseudonyms 1..* reports (reporter_pseudonym_id)
- reports 0..* moderation_actions (optional link via report_id)
- users 1..* moderation_actions (moderator_user_id)
- users 1..* audit_log (actor_user_id)
