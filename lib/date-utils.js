import { format, parseISO, formatISO } from 'date-fns'
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz'

// Get the application timezone from environment variable
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/New_York'

/**
 * Create a Date object from a date string (YYYY-MM-DD) in the app timezone
 * This ensures consistent date handling across the application
 */
export function createAppDate(dateString) {
  if (!dateString) return new Date()

  // Create date at midnight in the app timezone
  const dateWithTime = `${dateString}T00:00:00`
  const date = parseISO(dateWithTime)
  return fromZonedTime(date, APP_TIMEZONE)
}

/**
 * Format a date string or Date object for display using the app timezone
 */
export function formatAppDate(date, formatString = 'EEEE, MMMM d, yyyy') {
  if (!date) return ''

  if (typeof date === 'string') {
    // For date strings, use formatInTimeZone directly
    return formatInTimeZone(createAppDate(date), APP_TIMEZONE, formatString)
  } else {
    // For Date objects, convert to app timezone first
    const zonedDate = toZonedTime(date, APP_TIMEZONE)
    return format(zonedDate, formatString)
  }
}

/**
 * Get today's date as a YYYY-MM-DD string in the app timezone
 */
export function getTodayString() {
  const now = new Date()
  return formatInTimeZone(now, APP_TIMEZONE, 'yyyy-MM-dd')
}

/**
 * Convert a date string (YYYY-MM-DD) to ISO format for database storage
 * Always stores as the start of day in the app timezone
 */
export function dateStringToISO(dateString) {
  if (!dateString) return null

  const appDate = createAppDate(dateString)
  return formatISO(appDate)
}

/**
 * Convert an ISO date to a date string (YYYY-MM-DD) in the app timezone
 */
export function isoToDateString(isoString) {
  if (!isoString) return ''

  const date = parseISO(isoString)
  const zonedDate = toZonedTime(date, APP_TIMEZONE)
  return format(zonedDate, 'yyyy-MM-dd')
}

/**
 * Get the current app timezone
 */
export function getAppTimezone() {
  return APP_TIMEZONE
}

/**
 * Check if a date string is valid
 */
export function isValidDateString(dateString) {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return false
  }

  const date = createAppDate(dateString)
  return !isNaN(date.getTime())
}