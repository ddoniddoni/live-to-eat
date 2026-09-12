export async function saveExport(content: string, format: 'json' | 'csv'): Promise<void> {
  const blob = new Blob([content], {
    type: format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `LiveToEat-${Date.now()}.${format}`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
