# AskU

AskU is a small web platform I built as part of my Bachelor's thesis at the University of Tartu. The idea behind it is simple: many students stay quiet in class because they're afraid their question will sound stupid. AskU lets them ask anything anonymously, but only if they have a real `@ut.ee` email — so the platform stays trusted, and trolling has nowhere to hide.

Inside a course, you appear as something like `SwiftOwl247` instead of your real name. Your pseudonym changes every 24 hours, and you get a different one in every course, so no one can quietly track you across classes. Moderators can still find out who you are if you break the rules, but every time they do, it's written down in an audit log that they can't edit.

## Try it

The pilot version is live here:

- App: <https://ask-u.vercel.app>
- API: <https://asku-production.up.railway.app>

You'll need a `@ut.ee` email to sign in. I might pause the deployment after the thesis defence — if the link is dead, just run it locally (it takes about a minute, see below).

## How it's built

It's a normal web app, nothing exotic:

- **Frontend** — Vue 3 + TypeScript, styled with Tailwind, hosted on Vercel
- **Backend** — Node.js + Express + TypeScript, hosted on Railway
- **Database** — PostgreSQL with Prisma as the ORM
- **Email (for OTP codes)** — SendGrid in production, console output in development

The whole project is split into two folders inside `apps/`:

```
apps/
├── api/   ← backend (Express + Prisma)
└── web/   ← frontend (Vue 3)
```

## Run it locally

The easiest way is with Docker — one command starts the database, the API, and the web app together.

```bash
git clone https://github.com/<your-username>/AskU.git
cd AskU
cp .env.example .env
docker compose -f infra/docker-compose.yml up --build
```

Then open <http://localhost> in your browser. The API is on port `8000` and the database on `5433`.

When you're done:

```bash
docker compose -f infra/docker-compose.yml down
```

If you want to wipe the database too, add `-v` at the end.

### Without Docker

If you'd rather run things directly on your machine, you'll need Node.js 20+ and a Postgres 16 database somewhere. Then:

```bash
# backend
cd apps/api
npm install
npx prisma migrate deploy
npm run seed       # optional, adds sample courses
npm run dev        # http://localhost:8000

# frontend, in a new terminal
cd apps/web
npm install
npm run dev        # http://localhost:5173
```

### Logging in during development

You don't actually need to send real emails to test things. Two options:

- Set `DEV_AUTH=true` in `.env` — you'll be logged in automatically as a test user.
- Or leave the `SMTP_*` variables empty — the OTP code will just print to the API console, you can copy it from there.

## Configuration

Everything goes through `.env`. The example file (`.env.example`) is in the repo with comments next to each variable. The most important ones to set:

- `DATABASE_URL` — your Postgres connection string
- `CORS_ORIGIN` — where the frontend is running (e.g. `http://localhost:5173`)
- `MOD_KEY` — anything random, used as a fallback for moderator access
- `SMTP_*` — only needed in production, for sending OTP emails
- `VITE_API_BASE` (web side) — the URL where the API can be reached

> Don't commit your `.env` file — only `.env.example` should be in git.

## What's inside

A quick tour of the main features:

- Sign in with a `@ut.ee` email and a 6-digit code sent by email
- Browse courses and see threads inside each one
- Post threads and comments under your course pseudonym (or your real name, if you switch modes)
- React to posts, report things that shouldn't be there
- A moderator panel where reports can be reviewed, content hidden, and (when really needed) the identity behind a pseudonym revealed
- An audit log that records every sensitive moderator action — including identity lookups
- Sessions log out automatically after an hour of inactivity
- Rate limits to make spam annoying (3 threads/hour, 10 comments/hour, 5 reports/hour — stricter for brand-new accounts)

## How I tested it

I ran a three-week pilot with 21 University of Tartu students between 16 April and 4 May 2026. A few highlights from the post-use questionnaire:

- Students felt the platform was safe (mean 4.18 out of 5)
- They found it easy to use (mean 4.69 out of 5)
- 75% said they'd be more willing to ask a question on AskU than in Moodle Forums

The full evaluation, with all the numbers and what they actually mean, is in the thesis itself.

## Useful commands

For the backend (`apps/api`):

- `npm run dev` — run with hot reload
- `npm run build` — compile TypeScript
- `npm start` — run the compiled build
- `npm run seed` — fill the database with sample data
- `npx prisma studio` — open a small web UI to look at the database

For the frontend (`apps/web`):

- `npm run dev` — Vite dev server
- `npm run build` — production build
- `npm run preview` — preview the production build

## A few things to keep in mind

This is a Bachelor's thesis prototype, not a production-grade product. A couple of honest notes:

- Rate limits live in memory, so they reset whenever the API restarts. For real production you'd want Redis.
- There's only one moderator role, no multi-moderator review yet.
- OTP emails sometimes land in spam folders depending on how `@ut.ee` mailboxes filter SendGrid mail.

These are all written up properly in the Threats to Validity section of the thesis.

## Author

Built by **Jessenia Tsenkman** at the University of Tartu, 2026.  
Supervised by Iwada Eja Bassey, MSc.
