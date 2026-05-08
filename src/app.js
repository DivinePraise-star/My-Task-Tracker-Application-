const express = require("express");

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderPage(tasks, statusMessage = "") {
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
    <link rel="stylesheet" href="/styles.css" />
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

function createApp({ taskStore, emailNotifier }) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(express.static("public"));

  app.get("/", async (_req, res) => {
    const tasks = await taskStore.listTasks();
    res.type("html").send(renderPage(tasks));
  });

  app.post("/tasks", async (req, res) => {
    try {
      const task = await taskStore.addTask(req.body);
      await emailNotifier.sendTaskCreatedAlert(task);
      const tasks = await taskStore.listTasks();
      res.status(201).type("html").send(renderPage(tasks, "Task created. Email alert processed."));
    } catch (error) {
      const tasks = await taskStore.listTasks();
      res.status(400).type("html").send(renderPage(tasks, error.message));
    }
  });

  return app;
}

module.exports = { createApp };
