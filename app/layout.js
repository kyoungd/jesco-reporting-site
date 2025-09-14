import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { ClientProviders } from '@/components/providers/client-providers'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Jesco Investment Reporting',
  description: 'Professional investment reporting and portfolio management system',
}

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <div className="min-h-screen bg-gray-50 font-sans antialiased">
            <ClientProviders>
              {children}
            </ClientProviders>
          </div>
        </body>
      </html>
    </ClerkProvider>
  )
}