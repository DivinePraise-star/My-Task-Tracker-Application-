const express = require("express");
const { normalizeReminderSettings } = require("./services/reminderSettingsStore");

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderPage(tasks, reminderSettings, statusMessage = "") {
  const taskRows = tasks
    .map(
      (task) => `
      <tr>
        <td>${escapeHtml(task.title)}</td>
        <td>${escapeHtml(task.description || "—")}</td>
        <td>${escapeHtml(task.dueDate || "—")}</td>
        <td>${escapeHtml(task.recipientEmail || "—")}</td>
      </tr>
    `
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Task Tracker</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <main class="container">
      <h1>Task Tracker</h1>
      <p class="subtitle">Manage your tasks and trigger email alerts for new task assignments.</p>
      ${statusMessage ? `<p class="status">${escapeHtml(statusMessage)}</p>` : ""}
      <section class="card">
        <h2>Add a Task</h2>
        <form method="post" action="/tasks" class="form-grid">
          <label>Task title<input required name="title" maxlength="120" /></label>
          <label>Description<textarea name="description" rows="3" maxlength="500"></textarea></label>
          <label>Due date<input type="date" name="dueDate" /></label>
          <label>Alert email<input type="email" name="recipientEmail" placeholder="name@example.com" /></label>
          <button type="submit">Create Task</button>
        </form>
      </section>
      <section class="card">
        <h2>Reminder Settings</h2>
        <form method="post" action="/settings/reminders" class="form-grid">
          <label>Days ahead for reminders
            <input type="number" min="0" max="30" name="daysAhead" value="${escapeHtml(String(reminderSettings.daysAhead))}" />
          </label>
          <label>Check interval (minutes)
            <input type="number" min="1" max="1440" name="intervalMinutes" value="${escapeHtml(String(reminderSettings.intervalMinutes))}" />
          </label>
          <label>
            <input type="checkbox" name="enabled" ${reminderSettings.enabled ? "checked" : ""} /> Enable reminders
          </label>
          <button type="submit">Save Reminder Settings</button>
        </form>
      </section>
      <section class="card">
        <h2>Current Tasks</h2>
        <table>
          <thead>
            <tr><th>Title</th><th>Description</th><th>Due Date</th><th>Alert Email</th></tr>
          </thead>
          <tbody>${taskRows || '<tr><td colspan="4">No tasks added yet.</td></tr>'}</tbody>
        </table>
      </section>
    </main>
  </body>
</html>`;
}

function createApp({ taskStore, emailNotifier, reminderSettingsStore, reminderScheduler }) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  app.use((req, res, next) => {
    if (allowedOrigin && req.path.startsWith("/api/")) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }

    if (req.method === "OPTIONS" && req.path.startsWith("/api/")) {
      return res.sendStatus(204);
    }

    return next();
  });
  app.use(express.static("public"));

  const getSettings = async () => {
    if (!reminderSettingsStore?.getSettings) {
      return {
        enabled: true,
        daysAhead: Number(process.env.REMINDER_DAYS_AHEAD || 1),
        intervalMinutes: Number(process.env.REMINDER_INTERVAL_MINUTES || 60)
      };
    }

    return reminderSettingsStore.getSettings();
  };

  app.get("/", async (_req, res) => {
    const settings = await getSettings();
    const tasks = await taskStore.listTasks();
    res.type("html").send(renderPage(tasks, settings));
  });

  app.get("/api/reminder-settings", async (_req, res) => {
    const settings = await getSettings();
    res.json(settings);
  });

  app.get("/api/tasks", async (_req, res) => {
    const tasks = await taskStore.listTasks();
    res.json(tasks);
  });

  app.post("/api/tasks", async (req, res) => {
    try {
      const task = await taskStore.addTask(req.body);
      await emailNotifier.sendTaskCreatedAlert(task);
      res.status(201).json({
        message: "Task created. Email alert processed.",
        task
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/reminder-settings", async (req, res) => {
    try {
      if (!reminderSettingsStore?.updateSettings) {
        return res.status(501).json({ message: "Reminder settings are not available." });
      }

      const payload = normalizeReminderSettings(
        {
          enabled: typeof req.body.enabled === "boolean" ? req.body.enabled : req.body.enabled === "true",
          daysAhead: req.body.daysAhead,
          intervalMinutes: req.body.intervalMinutes
        },
        await getSettings()
      );

      const next = await reminderSettingsStore.updateSettings(payload);
      if (reminderScheduler?.refreshSchedule) {
        await reminderScheduler.refreshSchedule();
      }
      res.json(next);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/settings/reminders", async (req, res) => {
    try {
      if (!reminderSettingsStore?.updateSettings) {
        throw new Error("Reminder settings are not available.");
      }

      const next = await reminderSettingsStore.updateSettings({
        enabled: req.body.enabled === "on",
        daysAhead: req.body.daysAhead,
        intervalMinutes: req.body.intervalMinutes
      });

      if (reminderScheduler?.refreshSchedule) {
        await reminderScheduler.refreshSchedule();
      }

      const tasks = await taskStore.listTasks();
      res.type("html").send(renderPage(tasks, next, "Reminder settings updated."));
    } catch (error) {
      const settings = await getSettings();
      const tasks = await taskStore.listTasks();
      res.status(400).type("html").send(renderPage(tasks, settings, error.message));
    }
  });

  app.post("/tasks", async (req, res) => {
    try {
      const task = await taskStore.addTask(req.body);
      await emailNotifier.sendTaskCreatedAlert(task);
      const settings = await getSettings();
      const tasks = await taskStore.listTasks();
      res.status(201).type("html").send(renderPage(tasks, settings, "Task created. Email alert processed."));
    } catch (error) {
      const settings = await getSettings();
      const tasks = await taskStore.listTasks();
      res.status(400).type("html").send(renderPage(tasks, settings, error.message));
    }
  });

  return app;
}

module.exports = { createApp };
