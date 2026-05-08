const path = require("node:path");
const fs = require("node:fs/promises");
const os = require("node:os");
const test = require("node:test");
const assert = require("node:assert/strict");
const { TaskStore } = require("../src/services/taskStore");
const { createApp } = require("../src/app");

test("TaskStore adds and lists tasks", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "task-tracker-store-"));
  const taskFile = path.join(tempDir, "tasks.json");
  const store = new TaskStore(taskFile);

  await store.addTask({
    title: "Prepare sprint board",
    description: "Add high-priority tickets",
    dueDate: "2026-06-01",
    recipientEmail: "manager@example.com"
  });

  const tasks = await store.listTasks();
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, "Prepare sprint board");
  assert.equal(tasks[0].recipientEmail, "manager@example.com");
});

test("POST /tasks creates a task and triggers email notifier", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "task-tracker-app-"));
  const store = new TaskStore(path.join(tempDir, "tasks.json"));
  const sentTasks = [];
  const notifier = {
    async sendTaskCreatedAlert(task) {
      sentTasks.push(task);
      return { sent: true };
    }
  };

  const app = createApp({ taskStore: store, emailNotifier: notifier });
  const server = app.listen(0);

  try {
    const port = server.address().port;
    const response = await fetch(`http://127.0.0.1:${port}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        title: "Submit status report",
        description: "Share weekly summary",
        dueDate: "2026-05-12",
        recipientEmail: "teamlead@example.com"
      })
    });

    const html = await response.text();
    assert.equal(response.status, 201);
    assert.match(html, /Task created\. Email alert processed\./);
    assert.equal(sentTasks.length, 1);
    assert.equal(sentTasks[0].title, "Submit status report");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
