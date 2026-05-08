const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

class TaskStore {
  constructor(filePath) {
    this.filePath = filePath;
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
    return this.#readTasks();
  }

  async addTask(taskInput) {
    if (!taskInput?.title?.trim()) {
      throw new Error("Task title is required.");
    }

    const tasks = await this.#readTasks();
    const task = {
      id: randomUUID(),
      title: taskInput.title.trim(),
      description: taskInput.description?.trim() || "",
      dueDate: taskInput.dueDate || null,
      recipientEmail: taskInput.recipientEmail?.trim() || "",
      createdAt: new Date().toISOString()
    };

    tasks.unshift(task);
    await fs.writeFile(this.filePath, JSON.stringify(tasks, null, 2), "utf8");
    return task;
  }
}

module.exports = { TaskStore };
