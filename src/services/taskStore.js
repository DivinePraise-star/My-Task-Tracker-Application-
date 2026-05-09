const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { ensureSchema, getPool, isDatabaseConfigured, mapTaskRow } = require("./database");

class TaskStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.useDatabase = isDatabaseConfigured();
  }

  async #ensureFile() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, "[]", "utf8");
    }
  }

  async #readTasks() {
    await this.#ensureFile();
    const raw = await fs.readFile(this.filePath, "utf8");
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async listTasks() {
    if (this.useDatabase) {
      await ensureSchema();
      const { rows } = await getPool().query("SELECT * FROM tasks ORDER BY created_at DESC");
      return rows.map(mapTaskRow);
    }

    return this.#readTasks();
  }

  async listPendingReminderTasks({ dueWithinDays = 1, now = new Date() } = {}) {
    if (this.useDatabase) {
      await ensureSchema();
      const { rows } = await getPool().query(
        `
          SELECT *
          FROM tasks
          WHERE recipient_email <> ''
            AND due_date IS NOT NULL
            AND reminder_sent_at IS NULL
            AND due_date >= CURRENT_DATE
            AND due_date <= CURRENT_DATE + $1::int
          ORDER BY due_date ASC, created_at ASC
        `,
        [Number(dueWithinDays)]
      );

      return rows.map(mapTaskRow);
    }

    const tasks = await this.#readTasks();
    const todayIso = now.toISOString().slice(0, 10);
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + Number(dueWithinDays));
    const cutoffIso = cutoff.toISOString().slice(0, 10);

    return tasks.filter(
      (task) =>
        Boolean(task.recipientEmail) &&
        Boolean(task.dueDate) &&
        !task.reminderSentAt &&
        task.dueDate >= todayIso &&
        task.dueDate <= cutoffIso
    );
  }

  async markReminderSent(taskId, sentAt = new Date().toISOString()) {
    if (this.useDatabase) {
      await ensureSchema();
      const result = await getPool().query(
        `UPDATE tasks SET reminder_sent_at = $2::timestamptz WHERE id = $1 RETURNING id`,
        [taskId, sentAt]
      );

      return result.rowCount > 0;
    }

    const tasks = await this.#readTasks();
    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    if (taskIndex < 0) {
      return false;
    }

    tasks[taskIndex] = {
      ...tasks[taskIndex],
      reminderSentAt: sentAt
    };

    await fs.writeFile(this.filePath, JSON.stringify(tasks, null, 2), "utf8");
    return true;
  }

  async addTask(taskInput) {
    if (!taskInput?.title?.trim()) {
      throw new Error("Task title is required.");
    }

    if (this.useDatabase) {
      await ensureSchema();
      const task = {
        id: randomUUID(),
        title: taskInput.title.trim(),
        description: taskInput.description?.trim() || "",
        dueDate: taskInput.dueDate || null,
        recipientEmail: taskInput.recipientEmail?.trim() || "",
        createdAt: new Date().toISOString(),
        reminderSentAt: null
      };

      const { rows } = await getPool().query(
        `
          INSERT INTO tasks (id, title, description, due_date, recipient_email, created_at, reminder_sent_at)
          VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz)
          RETURNING *
        `,
        [
          task.id,
          task.title,
          task.description,
          task.dueDate,
          task.recipientEmail,
          task.createdAt,
          task.reminderSentAt
        ]
      );

      return mapTaskRow(rows[0]);
    }

    const tasks = await this.#readTasks();
    const task = {
      id: randomUUID(),
      title: taskInput.title.trim(),
      description: taskInput.description?.trim() || "",
      dueDate: taskInput.dueDate || null,
      recipientEmail: taskInput.recipientEmail?.trim() || "",
      createdAt: new Date().toISOString(),
      reminderSentAt: null
    };

    tasks.unshift(task);
    await fs.writeFile(this.filePath, JSON.stringify(tasks, null, 2), "utf8");
    return task;
  }
}

module.exports = { TaskStore };
