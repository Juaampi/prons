import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password) {
  console.error("Uso: node ./scripts/hash-password.js \"tu-password\"");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
console.log(hash);
