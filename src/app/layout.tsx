import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'АгроПогода — Мониторинг погоды', description: 'Сравнение прогнозов для сельского хозяйства' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ru"><body>{children}</body></html>;
}
