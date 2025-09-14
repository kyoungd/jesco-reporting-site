import React from 'react'
import { clsx } from 'clsx'

const alertVariants = {
  default: "border-gray-200 bg-gray-50 text-gray-900",
  destructive: "border-red-200 bg-red-50 text-red-900",
  warning: "border-yellow-200 bg-yellow-50 text-yellow-900",
  success: "border-green-200 bg-green-50 text-green-900"
}

export function Alert({ children, variant = "default", className, ...props }) {
  return (
    <div
      className={clsx(
        "rounded border px-4 py-3",
        alertVariants[variant],
        className
      )}
      role="alert"
      {...props}
    >
      {children}
    </div>
  )
}

export function AlertDescription({ children, className, ...props }) {
  return (
    <div
      className={clsx("text-sm", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function AlertTitle({ children, className, ...props }) {
  return (
    <h5
      className={clsx("mb-1 font-medium leading-none tracking-tight", className)}
      {...props}
    >
      {children}
    </h5>
  )
}