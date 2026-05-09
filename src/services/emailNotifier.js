const nodemailer = require("nodemailer");

class EmailNotifier {
  constructor(options = {}) {
    this.senderEmail = options.senderEmail || process.env.ALERT_SENDER_EMAIL || "no-reply@task-tracker.local";
    this.transport =
      options.transport ||
      this.#buildTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      });
  }

  #buildTransport(config) {
    if (config.host && config.port && config.user && config.pass) {
      return nodemailer.createTransport({
        host: config.host,
        port: Number(config.port),
        secure: Number(config.port) === 465,
        auth: {
          user: config.user,
          pass: config.pass
        }
      });
    }

    return nodemailer.createTransport({ jsonTransport: true });
  }

  async sendTaskCreatedAlert(task) {
    if (!task.recipientEmail) {
      return { sent: false, reason: "No recipient email provided." };
    }

    const dueDateText = task.dueDate ? `Due date: ${task.dueDate}` : "No due date set";
    await this.transport.sendMail({
      from: this.senderEmail,
      to: task.recipientEmail,
      subject: `New Task Added: ${task.title}`,
      text: `A new task has been added.\n\nTitle: ${task.title}\nDescription: ${task.description || "N/A"}\n${dueDateText}`
    });

    return { sent: true };
  }

  async sendTaskReminder(task) {
    if (!task.recipientEmail || !task.dueDate) {
      return { sent: false, reason: "Missing recipient email or due date." };
    }

    await this.transport.sendMail({
      from: this.senderEmail,
      to: task.recipientEmail,
      subject: `Reminder: ${task.title} is due on ${task.dueDate}`,
      text: `Task reminder\n\nTitle: ${task.title}\nDescription: ${task.description || "N/A"}\nDue date: ${task.dueDate}`
    });

    return { sent: true };
  }
}

module.exports = { EmailNotifier };
