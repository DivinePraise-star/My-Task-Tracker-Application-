# My-Task-Tracker-Application-

A professional web-based task tracker to manage daily tasks and trigger email alerts when a task is created.

## Features
- Add and view tasks from a web interface
- Persist task data in Supabase Postgres when `DATABASE_URL` is set, with local JSON fallback for development
- Send email alerts to a task recipient when a new task is added

## Run locally
```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## Email alert setup
Set these environment variables to send real emails via SMTP:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `ALERT_SENDER_EMAIL` (optional, default: `no-reply@task-tracker.local`)

### Reminder emails

The server now sends due-date reminder emails automatically for tasks that:
- have `recipientEmail`
- have `dueDate`
- have not already received a reminder

Optional reminder tuning variables:
- `REMINDER_DAYS_AHEAD` (default: `1`) - send reminders for tasks due within this many days
- `REMINDER_INTERVAL_MINUTES` (default: `60`) - how often the scheduler checks for due reminders

You can also update these at runtime from the app UI in the **Reminder Settings** card, or by API:

```bash
curl -X POST http://localhost:3000/api/reminder-settings \
	-H "Content-Type: application/json" \
	-d '{"enabled":true,"daysAhead":2,"intervalMinutes":30}'
```

Read current reminder settings:

```bash
curl http://localhost:3000/api/reminder-settings
```

If SMTP variables are not set, the app still processes alert creation using a local JSON transport (safe for local development/testing).

For persistent backend storage on Render, set `DATABASE_URL` to your Supabase Postgres connection string.

## Tests
```bash
npm test
```

## Deploy to GitHub Pages (static frontend)

This repository includes a polished static frontend in the `public/` folder that can be hosted on GitHub Pages. The static site uses `localStorage` for tasks when no backend URL is configured, and can also connect to the Render backend for real email reminders.

1. Push your repository to GitHub.
2. From the project root run:

```bash
npm run deploy
```

This uses `gh-pages` via `npx` and will publish the `public/` folder to the `gh-pages` branch. After deployment, enable GitHub Pages for the repo (if required) and use the `gh-pages` branch as the source, or visit `https://<your-username>.github.io/<your-repo>/`.

Notes:
- The deployed site is fully client-side until you enter a backend URL.
- If you want the server features (persistent data and email alerts), host the Node server on Render and connect it to Supabase Postgres.

## Deploy backend on Render

Use a **Web Service** (Node) on Render. Your backend entry point is `src/server.js`, started via `npm start` from `package.json`.

### Files Render uses
- `package.json` - provides build/start scripts (`npm install`, `npm start`)
- `src/server.js` - backend startup file
- `src/app.js` and `src/services/*` - API, reminders, email logic
- `render.yaml` - optional Blueprint config for one-click Render setup

### Recommended deploy method (Blueprint)
1. Push this repo to GitHub.
2. In Render, choose **New + -> Blueprint**.
3. Select this repository. Render reads `render.yaml` and creates the service + environment settings.
4. After first deploy, set secret env vars in Render dashboard:
	 - `DATABASE_URL` (from Supabase)
	 - `SMTP_USER`
	 - `SMTP_PASS` (Gmail App Password)
	 - `ALERT_SENDER_EMAIL`

### Manual Render settings (if not using Blueprint)
- Runtime: `Node`
- Build Command: `npm install`
- Start Command: `npm start`
- Environment variables:
	- `DATABASE_URL=<your Supabase Postgres connection string>`

Required SMTP env vars for real email sending:
- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_USER=<your-gmail>`
- `SMTP_PASS=<gmail-app-password>`
- `ALERT_SENDER_EMAIL=<your-gmail>`

Supabase setup:
1. Create a Supabase project.
2. Open the database connection settings and copy the Postgres connection string.
3. Add that string to Render as `DATABASE_URL`.
4. Redeploy the Render service.

The app auto-creates the required tables on startup, so no manual SQL import is required.

Reminder scheduler env vars:
- `REMINDER_DAYS_AHEAD=1`
- `REMINDER_INTERVAL_MINUTES=15`

For GitHub Pages frontend to call your Render backend from the browser, add:
- `ALLOWED_ORIGIN=https://<your-username>.github.io`

If your Pages site is a project page (repo path), use the full origin only (do not include repo path), for example:
- `ALLOWED_ORIGIN=https://divinepraise-star.github.io`

## Any user email reminders from the hosted frontend

The static site (`public/index.html`) now supports a backend connection mode:
1. Open your GitHub Pages site.
2. In **Backend Connection**, paste your Render URL (for example `https://my-task-tracker-backend.onrender.com`).
3. Save.
4. Create a task and set **Alert email** to any user's email.

What happens:
- Task is sent to your backend `POST /api/tasks`
- Backend stores task in Supabase Postgres and sends creation email alert
- Scheduler later sends due-date reminder email to that task's `recipientEmail`
