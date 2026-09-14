import type { ReactNode } from 'react';
import { Sheet } from '@/components/ui/Sheet';

type PlaceSheetLayoutProps = {
  children: ReactNode;
  closeLabel: string;
  eyebrow: string;
  onDismiss: () => void;
  title: string;
  visible: boolean;
  unsavedChanges?: boolean;
  busy?: boolean;
};

export function PlaceSheetLayout({
  children,
  closeLabel,
  eyebrow,
  onDismiss,
  title,
  visible,
  unsavedChanges = false,
  busy = false,
}: PlaceSheetLayoutProps) {
  if (!visible) return null;
  return (
    <Sheet
      title={title}
      subtitle={eyebrow}
      closeLabel={closeLabel}
      onClose={onDismiss}
      scrollable={false}
      unsavedChanges={unsavedChanges}
      busy={busy}
    >
      {children}
    </Sheet>
  );
}
