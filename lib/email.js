import crypto from 'crypto'
import postmark from 'postmark'

/**
 * Generate a secure invitation token
 */
export function generateInviteToken() {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Send invitation email (mock implementation for development)
 * In production, this would integrate with an email service like SendGrid, Resend, etc.
 */
export async function sendInvitationEmail({
  email,
  contactName,
  companyName,
  inviteToken,
  invitedBy,
  expiryDate
}) {
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite?token=${inviteToken}`
  const expiryDateFormatted = new Date(expiryDate).toLocaleDateString()

  const emailContent = {
    to: email,
    subject: 'Invitation to Jesco Investment Reporting',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="color: #1f2937; font-size: 24px; margin-bottom: 10px;">
            Welcome to Jesco Investment Reporting
          </h1>
          <p style="color: #6b7280; font-size: 14px; margin: 0;">
            Professional investment reporting and portfolio management system
          </p>
        </div>
        
        <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 20px;">
            You're Invited!
          </h2>
          
          <p style="color: #374151; line-height: 1.6; margin-bottom: 20px;">
            Hello ${contactName},
          </p>
          
          <p style="color: #374151; line-height: 1.6; margin-bottom: 20px;">
            You have been invited by <strong>${invitedBy}</strong> to join Jesco Investment Reporting 
            for <strong>${companyName}</strong>.
          </p>
          
          <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <h3 style="color: #1e40af; font-size: 16px; margin: 0 0 8px 0;">
              Get Started
            </h3>
            <p style="color: #1e40af; font-size: 14px; margin: 0;">
              Click the button below to create your account and access the platform.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; font-weight: 500;
                      display: inline-block;">
              Accept Invitation
            </a>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">
              <strong>Important:</strong> This invitation will expire on ${expiryDateFormatted}.
            </p>
            
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="color: #2563eb; font-size: 14px; word-break: break-all;">
              ${inviteUrl}
            </p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 20px;">
          <p style="color: #9ca3af; font-size: 12px;">
            This invitation was sent to ${email}. If you didn't expect this invitation, 
            you can safely ignore this email.
          </p>
        </div>
      </div>
    `,
    text: `
Welcome to Jesco Investment Reporting

Hello ${contactName},

You have been invited by ${invitedBy} to join Jesco Investment Reporting for ${companyName}.

To accept your invitation and create your account, visit:
${inviteUrl}

This invitation will expire on ${expiryDateFormatted}.

If you didn't expect this invitation, you can safely ignore this email.

Best regards,
Jesco Investment Reporting Team
    `
  }

  // For development/testing, just log the email content
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    console.log('📧 INVITATION EMAIL (Development Mode)')
    console.log('To:', emailContent.to)
    console.log('Subject:', emailContent.subject)
    console.log('Invite URL:', inviteUrl)
    console.log('Expires:', expiryDateFormatted)
    console.log('---')
    
    // Simulate successful email sending
    return Promise.resolve({
      success: true,
      messageId: `dev-${Date.now()}`,
      inviteUrl
    })
  }

  // Production email sending would go here
  // Example with SendGrid:
  /*
  const sgMail = require('@sendgrid/mail')
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
  
  try {
    const result = await sgMail.send(emailContent)
    return {
      success: true,
      messageId: result[0].headers['x-message-id'],
      inviteUrl
    }
  } catch (error) {
    throw new Error(`Failed to send invitation email: ${error.message}`)
  }
  */

  // Example with Resend:
  /*
  import { Resend } from 'resend'
  const resend = new Resend(process.env.RESEND_API_KEY)
  
  try {
    const result = await resend.emails.send({
      from: 'invitations@jesco.com',
      ...emailContent
    })
    return {
      success: true,
      messageId: result.id,
      inviteUrl
    }
  } catch (error) {
    throw new Error(`Failed to send invitation email: ${error.message}`)
  }
  */

  throw new Error('Email service not configured for production')
}

/**
 * Send welcome email after successful activation
 */
export async function sendWelcomeEmail({
  email,
  contactName,
  companyName
}) {
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/clients`

  const emailContent = {
    to: email,
    subject: 'Welcome to Jesco Investment Reporting',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="color: #1f2937; font-size: 24px; margin-bottom: 10px;">
            Welcome to Jesco Investment Reporting
          </h1>
          <p style="color: #6b7280; font-size: 14px; margin: 0;">
            Your account is now active
          </p>
        </div>
        
        <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 20px;">
            Account Activated Successfully
          </h2>
          
          <p style="color: #374151; line-height: 1.6; margin-bottom: 20px;">
            Hello ${contactName},
          </p>
          
          <p style="color: #374151; line-height: 1.6; margin-bottom: 20px;">
            Welcome to Jesco Investment Reporting! Your account for <strong>${companyName}</strong> 
            has been successfully activated.
          </p>
          
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <h3 style="color: #166534; font-size: 16px; margin: 0 0 8px 0;">
              Getting Started
            </h3>
            <p style="color: #166534; font-size: 14px; margin: 0;">
              You can now access your dashboard and begin managing your investment reporting.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" 
               style="background-color: #16a34a; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; font-weight: 500;
                      display: inline-block;">
              Access Dashboard
            </a>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">
              If you have any questions or need assistance, please don't hesitate to reach out 
              to our support team.
            </p>
          </div>
        </div>
      </div>
    `,
    text: `
Welcome to Jesco Investment Reporting

Hello ${contactName},

Welcome to Jesco Investment Reporting! Your account for ${companyName} has been successfully activated.

You can now access your dashboard at: ${dashboardUrl}

If you have any questions or need assistance, please don't hesitate to reach out to our support team.

Best regards,
Jesco Investment Reporting Team
    `
  }

  // For development/testing
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    console.log('📧 WELCOME EMAIL (Development Mode)')
    console.log('To:', emailContent.to)
    console.log('Subject:', emailContent.subject)
    console.log('Dashboard URL:', dashboardUrl)
    console.log('---')
    
    return Promise.resolve({
      success: true,
      messageId: `dev-welcome-${Date.now()}`
    })
  }

  // Production email sending would be implemented here
  throw new Error('Email service not configured for production')
}

/**
 * Send contact form email to info@jesco.com using Postmark
 */
export async function sendContactFormEmail({
  name,
  email,
  company,
  phone,
  message
}) {
  // For development/testing
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    console.log('📧 CONTACT FORM EMAIL (Development Mode)')
    console.log('From:', email)
    console.log('Name:', name)
    console.log('Company:', company)
    console.log('Phone:', phone)
    console.log('Message:', message)
    console.log('---')
    
    return Promise.resolve({
      success: true,
      messageId: `dev-contact-${Date.now()}`
    })
  }

  // Production email sending with Postmark
  if (!process.env.POSTMARK_API_TOKEN) {
    throw new Error('Postmark API token not configured')
  }

  const client = new postmark.ServerClient(process.env.POSTMARK_API_TOKEN)

  try {
    const result = await client.sendEmail({
      From: process.env.POSTMARK_FROM_EMAIL || 'noreply@jesco.com',
      To: 'info@jesco.com',
      Subject: 'New Invitation Request - Jesco Investment Reporting',
      HtmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h1 style="color: #1f2937; font-size: 24px; margin-bottom: 10px;">
              New Invitation Request
            </h1>
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              Someone has requested access to Jesco Investment Reporting
            </p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e5e7eb;">
            <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 20px;">
              Contact Information
            </h2>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px 0; font-weight: 600; color: #374151; width: 120px;">Name:</td>
                <td style="padding: 12px 0; color: #6b7280;">${name}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px 0; font-weight: 600; color: #374151;">Email:</td>
                <td style="padding: 12px 0; color: #6b7280;">${email}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px 0; font-weight: 600; color: #374151;">Company:</td>
                <td style="padding: 12px 0; color: #6b7280;">${company}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px 0; font-weight: 600; color: #374151;">Phone:</td>
                <td style="padding: 12px 0; color: #6b7280;">${phone}</td>
              </tr>
            </table>
            
            ${message ? `
            <div style="margin-top: 20px;">
              <h3 style="color: #1f2937; font-size: 16px; margin-bottom: 10px;">Message:</h3>
              <div style="background-color: #f9fafb; padding: 16px; border-radius: 6px; border-left: 4px solid #3b82f6;">
                <p style="color: #374151; line-height: 1.6; margin: 0;">
                  ${message.replace(/\n/g, '<br>')}
                </p>
              </div>
            </div>
            ` : ''}
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                This request was submitted through the Jesco Investment Reporting website.
              </p>
            </div>
          </div>
        </div>
      `,
      TextBody: `
New Invitation Request - Jesco Investment Reporting

Contact Information:
Name: ${name}
Email: ${email}
Company: ${company}
Phone: ${phone}

${message ? `Message:\n${message}\n\n` : ''}This request was submitted through the Jesco Investment Reporting website.
      `,
      ReplyTo: email
    })

    return {
      success: true,
      messageId: result.MessageID
    }
  } catch (error) {
    console.error('Postmark email error:', error)
    throw new Error(`Failed to send contact form email: ${error.message}`)
  }
}