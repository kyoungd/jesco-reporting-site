'use client'

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'

export default function SsoCallback() {
  return <AuthenticateWithRedirectCallback />
}