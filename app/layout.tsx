import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'The Vitrine | Marketing Intelligence Studio',description:'Private marketing command centre for The Vitrine'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="fr"><body>{children}</body></html>}