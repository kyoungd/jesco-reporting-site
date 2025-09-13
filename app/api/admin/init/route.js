import { NextResponse } from 'next/server'
import { initializeDefaultAdmin, getAdminInvitationStatus } from '../../../../lib/init-admin.js'

export async function POST(request) {
  try {
    // Initialize default admin if it doesn't exist
    const result = await initializeDefaultAdmin()
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        existed: result.existed,
        inviteUrl: result.inviteUrl,
        message: result.message
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Admin initialization error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to initialize admin user'
    }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    // Get current admin status
    const status = await getAdminInvitationStatus()
    
    return NextResponse.json({
      success: true,
      ...status
    })
  } catch (error) {
    console.error('Admin status check error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to check admin status'
    }, { status: 500 })
  }
}