# AskU — Entity Relationship Diagram

The diagram below shows all database tables and their relationships.  
Generated from `apps/api/prisma/schema.prisma`.

```mermaid
erDiagram

    User {
        uuid    id              PK
        string  email           UK
        string  utSubject       UK  "placeholder for future UT SSO"
        datetime emailVerifiedAt
        datetime createdAt
        datetime updatedAt
    }

    Session {
        uuid    id          PK
        uuid    userId      FK
        string  tokenHash   UK  "SHA-256 of the session cookie value"
        datetime expiresAt
        datetime createdAt
    }

    AuthCode {
        uuid    id          PK
        string  email
        string  codeHash        "SHA-256 of the 6-digit OTP"
        datetime expiresAt      "10 minutes from creation"
        int     attempts        "incremented on wrong code; max 5"
        datetime createdAt
    }

    Role {
        uuid    id      PK
        enum    name    UK  "STUDENT | STAFF | MODERATOR | ADMIN"
    }

    UserRole {
        uuid    userId  FK
        uuid    roleId  FK
    }

    Course {
        uuid    id          PK
        string  code            "e.g. LTAT.00.001"
        string  title
        string  semester        "e.g. 2024/2025 Spring"
        datetime createdAt
    }

    Enrollment {
        uuid        userId          FK
        uuid        courseId        FK
        enum        enrollmentRole      "STUDENT | STAFF (optional)"
    }

    Pseudonym {
        uuid    id          PK
        uuid    userId      FK
        uuid    courseId    FK
        string  publicName      "e.g. SwiftOwl342 — unique per course"
        datetime createdAt
    }

    Thread {
        uuid    id                  PK
        uuid    courseId            FK
        uuid    authorPseudonymId   FK
        string  title
        string  body
        string  status              "OPEN (default)"
        bool    isHidden            "soft-delete flag"
        datetime createdAt
    }

    Comment {
        uuid    id                  PK
        uuid    threadId            FK
        uuid    authorPseudonymId   FK
        string  body
        bool    isHidden            "soft-delete flag"
        datetime createdAt
    }

    Report {
        uuid        id                  PK
        uuid        reporterPseudonymId FK
        enum        targetType          "THREAD | COMMENT"
        uuid        targetId            "ID of the reported Thread or Comment"
        string      reason              "SPAM | ABUSE"
        string      details             "optional free text"
        enum        status              "OPEN | REVIEWED | RESOLVED"
        datetime    createdAt
    }

    ModerationAction {
        uuid    id              PK
        uuid    reportId        FK  "optional — action can be taken without a report"
        uuid    moderatorUserId FK
        enum    actionType      "HIDE | DELETE"
        enum    targetType      "THREAD | COMMENT"
        uuid    targetId
        string  note            "optional moderator note"
        datetime createdAt
    }

    AuditLog {
        uuid    id          PK
        uuid    actorUserId FK
        string  eventType       "REPORT_CREATED | MOD_ACTION | THREAD_HIDDEN_BY_AUTHOR | ..."
        string  entityType      "THREAD | COMMENT"
        uuid    entityId
        json    metadataJson    "additional context"
        datetime createdAt
    }

    %% ── Relationships ──────────────────────────────────────────────────────────

    User         ||--o{ Session          : "has"
    User         ||--o{ UserRole         : "has"
    User         ||--o{ Pseudonym        : "has"
    User         ||--o{ Enrollment       : "has"
    User         ||--o{ ModerationAction : "performs"
    User         ||--o{ AuditLog         : "generates"

    Role         ||--o{ UserRole         : "assigned via"

    Course       ||--o{ Enrollment       : "has"
    Course       ||--o{ Pseudonym        : "has"
    Course       ||--o{ Thread           : "contains"

    Pseudonym    ||--o{ Thread           : "authors"
    Pseudonym    ||--o{ Comment          : "authors"
    Pseudonym    ||--o{ Report           : "files"

    Thread       ||--o{ Comment          : "has"

    Report       ||--o{ ModerationAction : "resolved by"
```

---

## Key design decisions

### Pseudonym as the privacy boundary

The `Pseudonym` table is the core privacy mechanism. It acts as a proxy identity: a user's real `userId` is never stored on `Thread` or `Comment` — only their `authorPseudonymId`. This means:

- The API can return author display names (`publicName`) without ever leaking `userId` or `email`.
- A single user can participate in multiple courses under different pseudonyms, making cross-course linking impossible for other users.
- Moderators can act on content without seeing who the real author is.

### Polymorphic `targetId` in Report and ModerationAction

Both `Report.targetId` and `ModerationAction.targetId` are plain UUIDs paired with a `targetType` enum (`THREAD | COMMENT`). This is a deliberate simplification for the MVP — it avoids two separate foreign-key relations and keeps the schema flat.

The trade-off is that the database cannot enforce referential integrity on `targetId`. For the thesis scope this is acceptable, but a production system would use separate nullable foreign keys (`threadId`, `commentId`) or a polymorphic association pattern.

### Soft-delete vs hard-delete

`Thread.isHidden` and `Comment.isHidden` implement soft deletion. When a thread or comment is hidden by its author or a moderator, the row stays in the database so that:

- Audit logs remain consistent (they reference the entity ID).
- The content can potentially be restored by an admin.
- Statistics (report counts, etc.) remain accurate.

Moderator DELETE actions (`ModActionType.DELETE`) do perform a hard delete for the MVP. This will need revisiting before production.

### Session security

Sessions are implemented with a random 32-byte token stored in an `httpOnly` cookie (`SameSite=Lax`). Only the SHA-256 hash of the token is stored in the database. If the database were compromised, the attacker would still not have valid session tokens.
