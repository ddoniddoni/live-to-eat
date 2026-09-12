import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
export async function saveExport(content: string, format: 'json' | 'csv'): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('SHARING_UNAVAILABLE');
  const file = new File(Paths.cache, `LiveToEat-${Date.now()}.${format}`);
  file.write(content);
  try {
    await Sharing.shareAsync(file.uri, {
      mimeType: format === 'json' ? 'application/json' : 'text/csv',
      UTI: format === 'json' ? 'public.json' : 'public.comma-separated-values-text',
    });
  } finally {
    if (file.exists) file.delete();
  }
}
