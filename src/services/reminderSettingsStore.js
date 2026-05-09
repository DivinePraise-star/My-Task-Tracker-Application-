const fs = require("node:fs/promises");
const path = require("node:path");

function normalizeReminderSettings(input = {}, defaults = {}) {
  const enabled =
    typeof input.enabled === "boolean"
      ? input.enabled
      : typeof defaults.enabled === "boolean"
      ? defaults.enabled
      : true;

  const daysAheadRaw = Number(input.daysAhead ?? defaults.daysAhead ?? 1);
  const intervalMinutesRaw = Number(input.intervalMinutes ?? defaults.intervalMinutes ?? 60);

  if (!Number.isFinite(daysAheadRaw) || daysAheadRaw < 0 || daysAheadRaw > 30) {
    throw new Error("`daysAhead` must be a number between 0 and 30.");
  }

  if (!Number.isFinite(intervalMinutesRaw) || intervalMinutesRaw < 1 || intervalMinutesRaw > 1440) {
    throw new Error("`intervalMinutes` must be a number between 1 and 1440.");
  }

  return {
    enabled,
    daysAhead: Math.floor(daysAheadRaw),
    intervalMinutes: Math.floor(intervalMinutesRaw)
  };
}

class ReminderSettingsStore {
  constructor(filePath, defaults = {}) {
    this.filePath = filePath;
    this.defaults = normalizeReminderSettings(defaults, {
      enabled: true,
      daysAhead: 1,
      intervalMinutes: 60
    });
  }

  async #ensureFile() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, JSON.stringify(this.defaults, null, 2), "utf8");
    }
  }

  async getSettings() {
    await this.#ensureFile();
    const raw = await fs.readFile(this.filePath, "utf8");

    try {
      const parsed = JSON.parse(raw);
      return normalizeReminderSettings(parsed, this.defaults);
    } catch {
      return this.defaults;
    }
  }

  async updateSettings(partial) {
    const current = await this.getSettings();
    const next = normalizeReminderSettings({ ...current, ...partial }, this.defaults);
    await fs.writeFile(this.filePath, JSON.stringify(next, null, 2), "utf8");
    return next;
  }
}

module.exports = { ReminderSettingsStore, normalizeReminderSettings };
