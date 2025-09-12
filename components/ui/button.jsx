import React from 'react'

export function Button({ children, variant = 'default', size = 'default', ...props }) {
  return (
    <button 
      className={`button ${variant} ${size}`}
      {...props}
    >
      {children}
    </button>
  )
}