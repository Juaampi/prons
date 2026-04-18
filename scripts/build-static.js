import fs from "node:fs/promises";
import path from "node:path";

const outputDir = path.resolve("dist");
const entriesToCopy = [
  "index.html",
  "styles.css",
  "script.js",
  "assets",
  "contacto",
  "formulario",
  "politica-de-privacidad",
  "terminos-y-condiciones",
  "admin",
];

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

for (const entry of entriesToCopy) {
  const source = path.resolve(entry);
  const target = path.join(outputDir, entry);
  await fs.cp(source, target, { recursive: true });
}

console.log("Static files copied to dist/");
