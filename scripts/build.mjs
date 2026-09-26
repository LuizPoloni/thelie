import { cp, mkdir, rm } from 'node:fs/promises';

const source = new URL('../', import.meta.url);
const output = new URL('../dist/', import.meta.url);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const name of ['index.html', 'styles.css', 'script.js']) {
  await cp(new URL(name, source), new URL(name, output));
}

await cp(new URL('assets/', source), new URL('assets/', output), { recursive: true });
