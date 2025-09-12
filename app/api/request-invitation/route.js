import { NextResponse } from 'next/server'
import { sendContactFormEmail } from '@/lib/email'

export async function POST(request) {
  try {
    const { name, email, company, phone, message } = await request.json()

    // Basic validation
    if (!name || !email || !company || !phone) {
      return NextResponse.json(
        { error: 'Name, email, company, and phone are required fields' },
        { status: 400 }
      )
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      )
    }

    // Send email
    const result = await sendContactFormEmail({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      company: company.trim(),
      phone: phone.trim(),
      message: message?.trim() || ''
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Your invitation request has been submitted successfully. We will review it and get back to you soon.'
      }, { status: 200 })
    } else {
      throw new Error('Failed to send email')
    }
  } catch (error) {
    console.error('Request invitation API error:', error)
    
    return NextResponse.json(
      { 
        error: 'Sorry, there was an error submitting your request. Please try again or contact us directly at info@jesco.com.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}