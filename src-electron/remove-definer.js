import { readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

/**
 * Remove DEFINER clause from all SQL procedures
 */
async function removeDefiner() {
  const storagePath = join(process.cwd(), "storage");
  const files = await readdir(storagePath);
  const sqlFiles = files.filter(
    (f) => f.endsWith(".sql") && !f.includes("migration")
  );

  console.log(`Processing ${sqlFiles.length} SQL files...\n`);

  for (const file of sqlFiles) {
    const filePath = join(storagePath, file);
    const content = await readFile(filePath, "utf-8");

    // Replace DEFINER clause
    const newContent = content.replace(
      /CREATE DEFINER=`[^`]+`@`[^`]+` PROCEDURE/g,
      "CREATE PROCEDURE"
    );

    if (content !== newContent) {
      await writeFile(filePath, newContent, "utf-8");
      console.log(`✓ ${file} - DEFINER removed`);
    } else {
      console.log(`○ ${file} - No DEFINER found`);
    }
  }

  console.log("\n✓ All files processed");
}

removeDefiner().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
