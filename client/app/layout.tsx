import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AXIOM Avatar',
  description: 'AXIOM full-body 3D avatar interface',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
