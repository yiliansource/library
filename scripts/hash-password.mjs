import { pbkdf2Sync, randomBytes } from "node:crypto";
import { exit, stderr, stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

const rl = createInterface({
    input: stdin,
    output: stdout,
});

const password = await rl.question("Password to hash: ");
rl.close();

if (!password) {
    stderr.write("No password was entered.\n");
    exit(1);
}

const iterations = 100_000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256");

const encoded = [
    "pbkdf2-sha256",
    iterations,
    salt.toString("base64"),
    hash.toString("base64"),
].join(":");

stdout.write(`${encoded}\n`);