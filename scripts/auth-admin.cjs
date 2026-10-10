// Local terminal only: passwords are read from hidden input, never argv or logs.
const readline = require("node:readline");

const store = require("../src/utils/auth/store.cjs");

async function main() {
  const [action, username] = process.argv.slice(2);
  if (!["reset-password", "disable", "enable"].includes(action) || !username) {
    throw new Error("Usage: node scripts/auth-admin.cjs reset-password|disable|enable USERNAME");
  }
  if (action === "reset-password") {
    if (!process.stdin.isTTY) throw new Error("Password reset requires an interactive terminal.");
    process.stdout.write("New password (hidden, at least 14 characters): ");
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    const password = await new Promise((resolve, reject) => {
      let value = "";
      const listener = (text, key) => {
        if (key?.ctrl && key.name === "c") {
          finish();
          reject(new Error("Cancelled"));
        } else if (key?.name === "return") {
          finish();
          resolve(value);
        } else if (key?.name === "backspace") value = value.slice(0, -1);
        else if (text && !key?.ctrl) value += text;
      };
      function finish() {
        process.stdin.off("keypress", listener);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write("\n");
      }
      process.stdin.on("keypress", listener);
      process.stdin.resume();
    });
    await store.resetPassword(username, password);
  } else {
    const db = store.database();
    db.exec("BEGIN IMMEDIATE");
    try {
      const account = db.prepare("SELECT id FROM accounts WHERE username=?").get(username.toLowerCase());
      if (!account) throw new Error("Account not found.");
      db.prepare("UPDATE accounts SET enabled=? WHERE id=?").run(action === "enable" ? 1 : 0, account.id);
      db.prepare("DELETE FROM sessions WHERE account_id=?").run(account.id);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  console.log("Account updated; existing sessions invalidated.");
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
