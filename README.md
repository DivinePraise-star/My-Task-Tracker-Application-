# My-Task-Tracker-Application-

A professional web-based task tracker to manage daily tasks and trigger email alerts when a task is created.

## Features
- Add and view tasks from a web interface
- Persist task data in `data/tasks.json`
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

If SMTP variables are not set, the app still processes alert creation using a local JSON transport (safe for local development/testing).

## Tests
```bash
npm test
```
