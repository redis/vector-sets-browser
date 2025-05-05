import "./globals.css"
import type { Metadata, Viewport } from 'next'
import ClientLayout from '../components/landing/ClientLayout'

export const metadata: Metadata = {
  title: 'Vector Sets Browser',
  description: 'Vector Sets Browser Application',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body>
                <ClientLayout>
                    {children}
                </ClientLayout>
            </body>
        </html>
    )
}
