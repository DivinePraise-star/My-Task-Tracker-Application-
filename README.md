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

## Deploy to GitHub Pages (static frontend)

This repository includes a polished static frontend in the `public/` folder that can be hosted on GitHub Pages. The static site uses `localStorage` for tasks (no backend) and is ideal for publishing a read-only/demo version.

1. Push your repository to GitHub.
2. From the project root run:

```bash
npm run deploy
```

This uses `gh-pages` via `npx` and will publish the `public/` folder to the `gh-pages` branch. After deployment, enable GitHub Pages for the repo (if required) and use the `gh-pages` branch as the source, or visit `https://<your-username>.github.io/<your-repo>/`.

Notes:
- The deployed site is fully client-side and does not perform email notifications.
- If you want the server features (JSON persistence and email alerts), host the Node server separately (e.g., Render, Fly, Heroku) and keep this repo's `public/` frontend published to GitHub Pages.
