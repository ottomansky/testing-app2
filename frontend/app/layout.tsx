import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import Providers from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Demo Analytics Dashboard',
  description: 'Demo Analytics Dashboard — powered by Keboola',
  icons: {
    icon: [
      { url: '/keboola-icon.svg', type: 'image/svg+xml' },
    ],
  },
}

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
