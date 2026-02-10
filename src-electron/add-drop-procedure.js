import { readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

/**
 * Add DROP PROCEDURE IF EXISTS before CREATE PROCEDURE
 */
async function addDropProcedure() {
  const storagePath = join(process.cwd(), "storage");
  const files = await readdir(storagePath);
  const sqlFiles = files.filter(
    (f) => f.endsWith(".sql") && !f.includes("migration")
  );

  console.log(`Processing ${sqlFiles.length} SQL files...\n`);

  for (const file of sqlFiles) {
    const filePath = join(storagePath, file);
    let content = await readFile(filePath, "utf-8");

    // Extract procedure name from CREATE PROCEDURE statement
    const match = content.match(/CREATE PROCEDURE `([^`]+)`\.`([^`]+)`/);

    if (match) {
      const database = match[1];
      const procedureName = match[2];

      // Check if DROP already exists
      if (!content.includes("DROP PROCEDURE")) {
        const dropStatement = `DROP PROCEDURE IF EXISTS \`${database}\`.\`${procedureName}\`;\n\n`;
        content = dropStatement + content;

        await writeFile(filePath, content, "utf-8");
        console.log(`✓ ${file} - Added DROP PROCEDURE IF EXISTS`);
      } else {
        console.log(`○ ${file} - DROP PROCEDURE already exists`);
      }
    } else {
      console.log(`✗ ${file} - Could not extract procedure name`);
    }
  }

  console.log("\n✓ All files processed");
}

addDropProcedure().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
