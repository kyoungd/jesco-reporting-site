'use client'

export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center p-8">
      <div 
        className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"
        role="status"
        aria-live="polite"
        aria-label="Loading"
      ></div>
      <span className="text-gray-600">{message}</span>
    </div>
  )
}