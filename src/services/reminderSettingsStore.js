const fs = require("node:fs/promises");
const path = require("node:path");
const { ensureSchema, getPool, isDatabaseConfigured, mapReminderSettingsRow } = require("./database");

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
    this.useDatabase = isDatabaseConfigured();
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
    if (this.useDatabase) {
      await ensureSchema();
      const { rows } = await getPool().query(
        `SELECT enabled, days_ahead, interval_minutes FROM reminder_settings WHERE id = 1`
      );

      if (!rows[0]) {
        return this.defaults;
      }

      return normalizeReminderSettings(mapReminderSettingsRow(rows[0], this.defaults), this.defaults);
    }

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
    if (this.useDatabase) {
      await ensureSchema();
      const next = normalizeReminderSettings(partial, this.defaults);
      const { rows } = await getPool().query(
        `
          INSERT INTO reminder_settings (id, enabled, days_ahead, interval_minutes, updated_at)
          VALUES (1, $1, $2, $3, NOW())
          ON CONFLICT (id)
          DO UPDATE SET
            enabled = EXCLUDED.enabled,
            days_ahead = EXCLUDED.days_ahead,
            interval_minutes = EXCLUDED.interval_minutes,
            updated_at = NOW()
          RETURNING enabled, days_ahead, interval_minutes
        `,
        [next.enabled, next.daysAhead, next.intervalMinutes]
      );

      return normalizeReminderSettings(mapReminderSettingsRow(rows[0], this.defaults), this.defaults);
    }

    const current = await this.getSettings();
    const next = normalizeReminderSettings({ ...current, ...partial }, this.defaults);
    await fs.writeFile(this.filePath, JSON.stringify(next, null, 2), "utf8");
    return next;
  }
}

module.exports = { ReminderSettingsStore, normalizeReminderSettings };
