'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { cn } from '@/lib/utils'
import { AlertCircleIcon, CheckCircleIcon, LoaderIcon } from 'lucide-react'

const FormField = ({ 
  label, 
  name, 
  type = 'text', 
  placeholder, 
  register, 
  error, 
  required = false,
  disabled = false,
  options = [],
  className,
  description,
  ...props 
}) => {
  const fieldId = `field-${name}`
  
  const renderInput = () => {
    const commonProps = {
      id: fieldId,
      className: cn(
        'block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm',
        error && 'border-red-300 focus:ring-red-500 focus:border-red-500',
        disabled && 'bg-gray-50 text-gray-500 cursor-not-allowed',
        className
      ),
      disabled,
      ...register(name),
      ...props
    }

    switch (type) {
      case 'textarea':
        return (
          <textarea
            {...commonProps}
            placeholder={placeholder}
            rows={4}
          />
        )
      
      case 'select':
        return (
          <select {...commonProps}>
            <option value="">{placeholder || 'Select an option'}</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )
      
      case 'checkbox':
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              {...commonProps}
              className={cn(
                'h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded',
                error && 'border-red-300',
                disabled && 'bg-gray-50 cursor-not-allowed'
              )}
            />
            {label && (
              <label htmlFor={fieldId} className="ml-2 text-sm text-gray-700">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
              </label>
            )}
          </div>
        )
      
      case 'radio':
        return (
          <div className="space-y-2">
            {options.map((option) => (
              <div key={option.value} className="flex items-center">
                <input
                  type="radio"
                  value={option.value}
                  {...register(name)}
                  id={`${fieldId}-${option.value}`}
                  className={cn(
                    'h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300',
                    error && 'border-red-300',
                    disabled && 'bg-gray-50 cursor-not-allowed'
                  )}
                  disabled={disabled}
                />
                <label 
                  htmlFor={`${fieldId}-${option.value}`}
                  className="ml-2 text-sm text-gray-700"
                >
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        )
      
      case 'date':
      case 'datetime-local':
      case 'number':
      case 'email':
      case 'password':
      case 'tel':
      case 'url':
      default:
        return (
          <input
            type={type}
            placeholder={placeholder}
            {...commonProps}
          />
        )
    }
  }

  if (type === 'checkbox') {
    return (
      <div className="space-y-1">
        {renderInput()}
        {description && (
          <p className="text-sm text-gray-500">{description}</p>
        )}
        {error && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <AlertCircleIcon className="h-4 w-4" />
            {error.message}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {label && type !== 'checkbox' && (
        <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {renderInput()}
      {description && (
        <p className="text-sm text-gray-500">{description}</p>
      )}
      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <AlertCircleIcon className="h-4 w-4" />
          {error.message}
        </p>
      )}
    </div>
  )
}

const SubmitButton = ({
  children,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors'

  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 disabled:bg-indigo-400',
    secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-indigo-500 disabled:bg-gray-100',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-400'
  }

  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  }

  const handleClick = (e) => {
    console.log('🔘 SUBMIT BUTTON CLICKED')
    console.log('🔘 Button disabled:', disabled || loading)
    console.log('🔘 Button loading:', loading)
    console.log('🔘 Event:', e)

    // Call any onClick handler that was passed
    if (props.onClick) {
      console.log('🔘 Calling custom onClick handler')
      props.onClick(e)
    }
  }

  return (
    <button
      type="submit"
      disabled={disabled || loading}
      onClick={handleClick}
      className={cn(
        baseClasses,
        variants[variant],
        sizes[size],
        (disabled || loading) && 'cursor-not-allowed opacity-75',
        className
      )}
      {...props}
    >
      {loading && <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />}
      {children}
    </button>
  )
}

const ActionButton = ({ 
  children, 
  onClick,
  loading = false, 
  disabled = false, 
  variant = 'secondary',
  size = 'md',
  className,
  ...props 
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors'
  
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 disabled:bg-indigo-400',
    secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-indigo-500 disabled:bg-gray-100',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-400'
  }
  
  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        baseClasses,
        variants[variant],
        sizes[size],
        (disabled || loading) && 'cursor-not-allowed opacity-75',
        className
      )}
      {...props}
    >
      {loading && <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />}
      {children}
    </button>
  )
}

const FormMessage = ({ type = 'info', message, className }) => {
  if (!message) return null

  const styles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  }

  const icons = {
    success: CheckCircleIcon,
    error: AlertCircleIcon,
    warning: AlertCircleIcon,
    info: AlertCircleIcon
  }

  const Icon = icons[type]

  return (
    <div className={cn(
      'border rounded-md p-4',
      styles[type],
      className
    )}>
      <div className="flex">
        <Icon className="h-5 w-5 mr-2 flex-shrink-0" />
        <div className="text-sm">{message}</div>
      </div>
    </div>
  )
}

export function FormWrapper({
  schema,
  defaultValues = {},
  onSubmit,
  children,
  title,
  description,
  submitText = 'Submit',
  submitVariant = 'primary',
  showReset = false,
  resetText = 'Reset',
  onReset,
  loading = false,
  disabled = false,
  className,
  formClassName,
  actions,
  successMessage,
  errorMessage
}) {
  const [submitLoading, setSubmitLoading] = useState(false)
  const [formMessage, setFormMessage] = useState(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
    reset,
    watch,
    setValue,
    getValues,
    clearErrors
  } = useForm({
    resolver: schema ? zodResolver(schema) : undefined,
    defaultValues,
    mode: 'onChange'
  })

  // Log validation state changes
  console.log('📝 FORM STATE:', { errors, isValid, isSubmitting })

  const isLoading = loading || isSubmitting || submitLoading

  const handleFormSubmit = async (data) => {
    console.log('📝 FORM WRAPPER: handleFormSubmit called')
    console.log('📝 FORM WRAPPER: Form data:', data)
    console.log('📝 FORM WRAPPER: Form errors:', errors)

    try {
      setSubmitLoading(true)
      setFormMessage(null)
      console.log('📝 FORM WRAPPER: Calling onSubmit with data:', data)
      await onSubmit(data)
      console.log('📝 FORM WRAPPER: onSubmit completed successfully')
      if (successMessage) {
        setFormMessage({ type: 'success', message: successMessage })
      }
    } catch (error) {
      console.error('📝 FORM WRAPPER: Error in handleFormSubmit:', error)
      const message = error.message || errorMessage || 'An error occurred while submitting the form'
      setFormMessage({ type: 'error', message })
    } finally {
      setSubmitLoading(false)
      console.log('📝 FORM WRAPPER: Form submission completed')
    }
  }

  const handleReset = () => {
    reset(defaultValues)
    setFormMessage(null)
    if (onReset) {
      onReset()
    }
  }

  const formProps = {
    register,
    errors,
    watch,
    setValue,
    getValues,
    clearErrors,
    loading: isLoading,
    disabled: disabled || isLoading
  }

  return (
    <div className={cn('space-y-6', className)}>
      {(title || description) && (
        <div>
          {title && <h2 className="text-lg font-medium text-gray-900">{title}</h2>}
          {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
        </div>
      )}

      {formMessage && (
        <FormMessage 
          type={formMessage.type} 
          message={formMessage.message}
        />
      )}

      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        className={cn('space-y-6', formClassName)}
        onInvalid={(e) => {
          console.log('📝 FORM VALIDATION FAILED')
          console.log('📝 Invalid event:', e)
          console.log('📝 Form errors:', errors)
          console.log('📝 All form values:', getValues())
        }}
      >
        <div className="space-y-4">
          {typeof children === 'function' ? children(formProps) : children}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-3">
            {showReset && (
              <ActionButton
                onClick={handleReset}
                disabled={disabled || isLoading}
                variant="secondary"
              >
                {resetText}
              </ActionButton>
            )}
            {actions}
          </div>
          
          <SubmitButton
            loading={isLoading}
            disabled={disabled}
            variant={submitVariant}
          >
            {submitText}
          </SubmitButton>
        </div>
      </form>
    </div>
  )
}

export { FormField, SubmitButton, ActionButton, FormMessage }