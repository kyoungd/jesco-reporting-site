'use client'

import { AccountProvider } from '@/lib/account-context'

export function ClientProviders({ children }) {
  return (
    <AccountProvider>
      {children}
    </AccountProvider>
  )
}