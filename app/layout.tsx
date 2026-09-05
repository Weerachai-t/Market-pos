import type { Metadata, Viewport } from 'next';
import './globals.css';
import './theme.css';

export const metadata: Metadata = { title: 'Market POS', description: 'POS สำหรับร้านค้าตลาดนัด' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#111827' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
