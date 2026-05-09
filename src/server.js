const path = require("node:path");
const { createApp } = require("./app");
const { TaskStore } = require("./services/taskStore");
const { EmailNotifier } = require("./services/emailNotifier");
const { startReminderScheduler } = require("./services/reminderScheduler");
const { ReminderSettingsStore } = require("./services/reminderSettingsStore");

const port = Number(process.env.PORT || 3000);
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
const taskStore = new TaskStore(path.join(dataDir, "tasks.json"));
const reminderSettingsStore = new ReminderSettingsStore(path.join(dataDir, "reminderSettings.json"));
const emailNotifier = new EmailNotifier();
const schedulerBridge = {
  refreshSchedule: async () => {}
};
const app = createApp({
  taskStore,
  emailNotifier,
  reminderSettingsStore,
  reminderScheduler: schedulerBridge
});
const reminderScheduler = startReminderScheduler({
  taskStore,
  emailNotifier,
  reminderSettingsStore
});
schedulerBridge.refreshSchedule = reminderScheduler.refreshSchedule;

app.listen(port, () => {
  console.log(`Task Tracker running at http://localhost:${port}`);
});
