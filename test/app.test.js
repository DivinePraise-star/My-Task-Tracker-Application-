const path = require("node:path");
const fs = require("node:fs/promises");
const os = require("node:os");
const test = require("node:test");
const assert = require("node:assert/strict");
const { TaskStore } = require("../src/services/taskStore");
const { createApp } = require("../src/app");
const { processDueTaskReminders } = require("../src/services/reminderScheduler");
const { ReminderSettingsStore } = require("../src/services/reminderSettingsStore");

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

test("POST /api/tasks creates task and returns JSON", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "task-tracker-api-"));
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
    const response = await fetch(`http://127.0.0.1:${port}/api/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "API created task",
        description: "from static frontend",
        dueDate: "2026-05-12",
        recipientEmail: "user@example.com"
      })
    });

    assert.equal(response.status, 201);
    const body = await response.json();
    assert.match(body.message, /Task created\. Email alert processed\./);
    assert.equal(body.task.title, "API created task");
    assert.equal(sentTasks.length, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("API routes include CORS headers when ALLOWED_ORIGIN is set", async () => {
  const previousOrigin = process.env.ALLOWED_ORIGIN;
  process.env.ALLOWED_ORIGIN = "https://example.github.io";

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "task-tracker-cors-"));
  const store = new TaskStore(path.join(tempDir, "tasks.json"));
  const app = createApp({
    taskStore: store,
    emailNotifier: { async sendTaskCreatedAlert() {} }
  });
  const server = app.listen(0);

  try {
    const port = server.address().port;
    const response = await fetch(`http://127.0.0.1:${port}/api/tasks`);
    assert.equal(response.headers.get("access-control-allow-origin"), "https://example.github.io");
  } finally {
    if (typeof previousOrigin === "string") {
      process.env.ALLOWED_ORIGIN = previousOrigin;
    } else {
      delete process.env.ALLOWED_ORIGIN;
    }

    await new Promise((resolve) => server.close(resolve));
  }
});

test("POST /settings/reminders updates settings and returns status", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "task-tracker-settings-"));
  const store = new TaskStore(path.join(tempDir, "tasks.json"));
  const settingsStore = new ReminderSettingsStore(path.join(tempDir, "reminderSettings.json"));
  let refreshCalls = 0;
  const scheduler = {
    async refreshSchedule() {
      refreshCalls += 1;
    }
  };

  const app = createApp({
    taskStore: store,
    emailNotifier: { async sendTaskCreatedAlert() {} },
    reminderSettingsStore: settingsStore,
    reminderScheduler: scheduler
  });
  const server = app.listen(0);

  try {
    const port = server.address().port;
    const response = await fetch(`http://127.0.0.1:${port}/settings/reminders`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        daysAhead: "2",
        intervalMinutes: "30",
        enabled: "on"
      })
    });

    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /Reminder settings updated\./);
    assert.equal(refreshCalls, 1);

    const updated = await settingsStore.getSettings();
    assert.equal(updated.daysAhead, 2);
    assert.equal(updated.intervalMinutes, 30);
    assert.equal(updated.enabled, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("POST /api/reminder-settings updates settings JSON", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "task-tracker-settings-api-"));
  const store = new TaskStore(path.join(tempDir, "tasks.json"));
  const settingsStore = new ReminderSettingsStore(path.join(tempDir, "reminderSettings.json"));

  const app = createApp({
    taskStore: store,
    emailNotifier: { async sendTaskCreatedAlert() {} },
    reminderSettingsStore: settingsStore,
    reminderScheduler: { async refreshSchedule() {} }
  });
  const server = app.listen(0);

  try {
    const port = server.address().port;
    const response = await fetch(`http://127.0.0.1:${port}/api/reminder-settings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        enabled: false,
        daysAhead: 3,
        intervalMinutes: 45
      })
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.enabled, false);
    assert.equal(body.daysAhead, 3);
    assert.equal(body.intervalMinutes, 45);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Reminder scheduler sends due reminders and marks tasks", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "task-tracker-reminder-"));
  const store = new TaskStore(path.join(tempDir, "tasks.json"));
  const reminders = [];

  await store.addTask({
    title: "Pay utilities",
    description: "Monthly payment",
    dueDate: "2026-05-10",
    recipientEmail: "owner@example.com"
  });

  await store.addTask({
    title: "No email task",
    description: "Should not receive reminder",
    dueDate: "2026-05-10",
    recipientEmail: ""
  });

  const notifier = {
    async sendTaskReminder(task) {
      reminders.push(task.id);
      return { sent: true };
    }
  };

  const sentCount = await processDueTaskReminders({
    taskStore: store,
    emailNotifier: notifier,
    dueWithinDays: 1,
    now: new Date("2026-05-09T10:00:00.000Z")
  });

  assert.equal(sentCount, 1);
  assert.equal(reminders.length, 1);

  const tasks = await store.listTasks();
  const remindedTask = tasks.find((task) => task.title === "Pay utilities");
  assert.ok(remindedTask.reminderSentAt);
});
