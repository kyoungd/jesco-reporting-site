import React from 'react'

export function Select({ children, value, onValueChange, ...props }) {
  return (
    <select 
      {...props} 
      value={value} 
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  )
}

export function SelectContent({ children }) {
  return <>{children}</>
}

export function SelectItem({ children, value }) {
  return <option value={value}>{children}</option>
}

export function SelectTrigger({ children }) {
  return <>{children}</>
}

export function SelectValue({ placeholder }) {
  return <span>{placeholder}</span>
}