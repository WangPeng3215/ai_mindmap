import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(projectRoot, 'codex-skills', 'create-a-mindmap', 'SKILL.md');
const targets = [
  resolve(projectRoot, '.agents', 'skills', 'create-a-mindmap', 'SKILL.md'),
  resolve(projectRoot, '.claude', 'skills', 'create-a-mindmap', 'SKILL.md'),
  resolve(projectRoot, '.trae', 'skills', 'create-a-mindmap', 'SKILL.md'),
  resolve(projectRoot, 'workbuddy-skills', 'create-a-mindmap', 'SKILL.md'),
];

for (const target of targets) {
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}

process.stdout.write(`${JSON.stringify({ source, targets }, null, 2)}\n`);
