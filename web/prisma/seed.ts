import { runImport } from "../scripts/import-letterboxd";

async function main(): Promise<void> {
  await runImport();
}

export default main;
