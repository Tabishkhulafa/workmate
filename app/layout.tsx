import './globals.css';
import type { Metadata } from 'next'; 
export const metadata: Metadata = { title: 'Work Mate', description: 'Work Mate attendance and HR platform', manifest: '/manifest.webmanifest', appleWebApp: { capable: true, title: 'Work Mate', statusBarStyle: 'default' } }; 
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html> }
