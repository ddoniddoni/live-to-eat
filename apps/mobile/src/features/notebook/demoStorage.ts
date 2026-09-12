import { File, Paths } from 'expo-file-system';
import { notebookSchema, type Notebook } from '@live-to-eat/domain';
const filename = 'livetoeat-demo-v1.json';
export async function readDemo(): Promise<Notebook | null> {
  const file = new File(Paths.document, filename);
  if (!file.exists) return null;
  return notebookSchema.parse(JSON.parse(await file.text()));
}
export async function writeDemo(value: Notebook): Promise<void> {
  const file = new File(Paths.document, filename);
  const temporary = new File(Paths.document, `${filename}.tmp`);
  temporary.write(JSON.stringify(value));
  await temporary.move(file, { overwrite: true });
}
