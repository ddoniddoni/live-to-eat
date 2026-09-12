import { notebookSchema, type Notebook } from '@live-to-eat/domain';
const key = 'livetoeat.demo.v1';
export async function readDemo(): Promise<Notebook | null> {
  const raw = localStorage.getItem(key);
  return raw ? notebookSchema.parse(JSON.parse(raw)) : null;
}
export async function writeDemo(value: Notebook): Promise<void> {
  localStorage.setItem(key, JSON.stringify(value));
}
