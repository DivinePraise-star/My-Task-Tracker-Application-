async function processDueTaskReminders({ taskStore, emailNotifier, dueWithinDays = 1, now = new Date(), logger = console }) {
  const tasks = await taskStore.listPendingReminderTasks({ dueWithinDays, now });

  for (const task of tasks) {
    try {
      await emailNotifier.sendTaskReminder(task);
      await taskStore.markReminderSent(task.id);
      logger.log(`Reminder sent for task ${task.id}`);
    } catch (error) {
      logger.error(`Failed to send reminder for task ${task.id}: ${error.message}`);
    }
  }

  return tasks.length;
}

function startReminderScheduler({
  taskStore,
  emailNotifier,
  reminderSettingsStore,
  defaultSettings,
  logger = console
}) {
  let running = false;
  let timer = null;
  let stopped = false;

  const fallbackSettings = {
    enabled: process.env.REMINDER_ENABLED !== "false",
    daysAhead: Number(process.env.REMINDER_DAYS_AHEAD || defaultSettings?.daysAhead || 1),
    intervalMinutes: Number(process.env.REMINDER_INTERVAL_MINUTES || defaultSettings?.intervalMinutes || 60)
  };

  const clampIntervalMs = (minutes) => Math.max(60 * 1000, Number(minutes || 60) * 60 * 1000);

  const getSettings = async () => {
    if (!reminderSettingsStore?.getSettings) {
      return fallbackSettings;
    }

    return reminderSettingsStore.getSettings();
  };

  const run = async () => {
    if (running || stopped) {
      return;
    }

    running = true;
    try {
      const settings = await getSettings();
      if (!settings.enabled) {
        return;
      }

      await processDueTaskReminders({
        taskStore,
        emailNotifier,
        dueWithinDays: settings.daysAhead,
        logger
      });
    } finally {
      running = false;
    }
  };

  const scheduleNext = async () => {
    if (stopped) {
      return;
    }

    const settings = await getSettings();
    const intervalMs = clampIntervalMs(settings.intervalMinutes);
    clearTimeout(timer);
    timer = setTimeout(() => {
      run()
        .catch((error) => logger.error(`Scheduled reminder run failed: ${error.message}`))
        .finally(() => {
          scheduleNext().catch((error) => logger.error(`Failed to reschedule reminders: ${error.message}`));
        });
    }, intervalMs);
  };

  run().catch((error) => logger.error(`Initial reminder run failed: ${error.message}`));
  scheduleNext().catch((error) => logger.error(`Initial reminder scheduling failed: ${error.message}`));

  return {
    async runNow() {
      await run();
    },
    async refreshSchedule() {
      await scheduleNext();
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
    }
  };
}

module.exports = { processDueTaskReminders, startReminderScheduler };
