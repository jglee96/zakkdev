import { hash } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const output = process.argv[2];
  if (!output || process.stdin.isTTY) throw new Error("Pipe a password on stdin and specify a new output file.");
  const password = readFileSync(0, "utf8").replace(/\r?\n$/, "");
  if (password.length < 16 || Buffer.byteLength(password) > 1024) throw new Error("Use a password of at least 16 characters and at most 1024 bytes.");
  const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 });
  const secret = randomBytes(32).toString("base64url");
  writeFileSync(resolve(output), `FINANCE_PASSWORD_HASH='${passwordHash.replaceAll("$", "\\$")}'\nFINANCE_SESSION_SECRET='${secret}'\n`, { mode: 0o600, flag: "wx" });
  console.log("Credentials saved to the specified new file. No credential values were printed.");
}

main().catch(() => {
  console.error("Credential generation failed. Provide a strong password on stdin and a new writable output file.");
  process.exitCode = 1;
});
