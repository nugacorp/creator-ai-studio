import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** Message printed when the production worker starts up. */
export function getReadyMessage(): string {
  return 'Creator AI Studio production worker ready.';
}

/** Worker entry point. Placeholder: no jobs are processed yet. */
export function main(): void {
  console.log(getReadyMessage());
}

// Only run when executed directly (not when imported by tests).
const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main();
}
