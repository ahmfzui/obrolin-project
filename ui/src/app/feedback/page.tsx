"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function FeedbackPage() {
  const router = useRouter()
  useEffect(() => {
    // Redirect any direct visits to the old /feedback page back to /chat
    router.replace('/chat')
  }, [router])
  return null
}
