import bcrypt from "bcryptjs";
import pg from "pg";
const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const { rows: users } = await c.query("SELECT id, username, role, is_active FROM users");
console.log("Existing:", users);
const hash = await bcrypt.hash("1", 10);
const admin = users.find((u) => u.role === "admin");
if (admin) {
  await c.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, admin.id]);
  console.log("Updated password for:", admin.username);
} else {
  await c.query(
    "INSERT INTO users (username, password_hash, role, permissions, is_active) VALUES ($1, $2, $3, $4, true)",
    ["پەڕیوەبەر", hash, "admin", "[]"],
  );
  console.log("Created پەڕیوەبەر admin");
}
await c.end();
