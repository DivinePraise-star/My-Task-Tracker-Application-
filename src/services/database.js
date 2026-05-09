const { Pool } = require("pg");

let pool;
let schemaPromise;

function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!isDatabaseConfigured()) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
    });
  }

  return pool;
}

async function ensureSchema() {
  if (!isDatabaseConfigured()) {
    return false;
  }

  if (!schemaPromise) {
    schemaPromise = (async () => {
      const db = getPool();

      await db.query(`
        CREATE TABLE IF NOT EXISTS tasks (
          id UUID PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          due_date DATE,
          recipient_email TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          reminder_sent_at TIMESTAMPTZ
        )
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS reminder_settings (
          id SMALLINT PRIMARY KEY DEFAULT 1,
          enabled BOOLEAN NOT NULL DEFAULT TRUE,
          days_ahead INTEGER NOT NULL DEFAULT 1,
          interval_minutes INTEGER NOT NULL DEFAULT 60,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await db.query(`
        INSERT INTO reminder_settings (id, enabled, days_ahead, interval_minutes)
        VALUES (1, TRUE, 1, 60)
        ON CONFLICT (id) DO NOTHING
      `);
    })();
  }

  await schemaPromise;
  return true;
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
}

function mapTaskRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    dueDate: row.due_date ? String(row.due_date).slice(0, 10) : null,
    recipientEmail: row.recipient_email || "",
    createdAt: normalizeDate(row.created_at),
    reminderSentAt: row.reminder_sent_at ? normalizeDate(row.reminder_sent_at) : null
  };
}

function mapReminderSettingsRow(row, defaults) {
  if (!row) {
    return defaults;
  }

  return {
    enabled: Boolean(row.enabled),
    daysAhead: Number(row.days_ahead),
    intervalMinutes: Number(row.interval_minutes)
  };
}

module.exports = {
  ensureSchema,
  getPool,
  isDatabaseConfigured,
  mapReminderSettingsRow,
  mapTaskRow
};
