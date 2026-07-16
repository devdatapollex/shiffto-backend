import fs from "fs";
import path from "path";

const srcDir = path.join("src", "app", "lib", "email", "templates");
const destDir = path.join("dist", "templates");

try {
  // Ensure the destination parent directory exists
  fs.mkdirSync(path.dirname(destDir), { recursive: true });

  // Copy the templates folder recursively
  fs.cpSync(srcDir, destDir, { recursive: true });
  console.log("Templates copied successfully to dist/templates");
} catch (err) {
  console.error("Error copying templates:", err);
  process.exit(1);
}
