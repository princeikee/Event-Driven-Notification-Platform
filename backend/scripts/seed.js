const bcrypt = require("bcryptjs");
const { initDb, run, get } = require("../db");

async function seed() {
  await initDb();

  await run("DELETE FROM system_logs");
  await run("DELETE FROM notifications");
  await run("DELETE FROM events");
  await run("DELETE FROM users");

  const pass = await bcrypt.hash("password123", 10);

  const users = [
    { name: "Admin User", email: "admin@notifyflow.com", role: "admin" },
    { name: "Sarah Smith", email: "sarah@notifyflow.com", role: "user" },
    { name: "Mike Jones", email: "mike@notifyflow.com", role: "user" },
    { name: "Priya Patel", email: "priya@notifyflow.com", role: "user" },
  ];

  for (const u of users) {
    await run(
      "INSERT INTO users (name, email, role, is_active, password_hash, last_active) VALUES (?, ?, ?, 1, ?, CURRENT_TIMESTAMP)",
      [u.name, u.email, u.role, pass]
    );
  }

  const allUsers = [await get("SELECT id FROM users WHERE email = 'admin@notifyflow.com'"), await get("SELECT id FROM users WHERE email = 'sarah@notifyflow.com'"), await get("SELECT id FROM users WHERE email = 'mike@notifyflow.com'"), await get("SELECT id FROM users WHERE email = 'priya@notifyflow.com'")];

  for (const u of allUsers) {
    await run(
      "INSERT INTO events (user_id, type, message, is_demo) VALUES (?, 'signup', ?, 0)",
      [u.id, `Seed event for user #${u.id}`]
    );
    await run(
      "INSERT INTO notifications (user_id, type, title, message, status, is_demo) VALUES (?, 'broadcast', 'Platform Update', 'Seed notification payload', 'delivered', 0)",
      [u.id]
    );
    await run(
      "INSERT INTO system_logs (user_id, level, category, message) VALUES (?, 'info', 'seed', ?)",
      [u.id, `Seeded records for user #${u.id}`]
    );
  }

  console.log("Seed complete.");
  console.log("Admin login: admin@notifyflow.com / password123");
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});

