const path = require("node:path");
const { createApp } = require("./app");
const { TaskStore } = require("./services/taskStore");
const { EmailNotifier } = require("./services/emailNotifier");

const port = Number(process.env.PORT || 3000);
const taskStore = new TaskStore(path.join(process.cwd(), "data", "tasks.json"));
const emailNotifier = new EmailNotifier();
const app = createApp({ taskStore, emailNotifier });

app.listen(port, () => {
  console.log(`Task Tracker running at http://localhost:${port}`);
});
