'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

export default function CSVExportButton({ data, filename, disabled = false }) {
  const [isExporting, setIsExporting] = useState(false)

  const convertToCSV = (data) => {
    if (!data || data.length === 0) return ''
    
    const headers = Object.keys(data[0])
    const csvHeaders = headers.join(',')
    
    const csvRows = data.map(row => {
      return headers.map(header => {
        let value = row[header]
        
        // Handle null/undefined values
        if (value === null || value === undefined) {
          value = ''
        }
        
        // Convert to string and escape quotes
        value = String(value)
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = `"${value.replace(/"/g, '""')}"`
        }
        
        return value
      }).join(',')
    })
    
    return [csvHeaders, ...csvRows].join('\n')
  }

  const handleExport = async () => {
    if (!data || data.length === 0) return
    
    setIsExporting(true)
    try {
      const csvContent = convertToCSV(data)
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Error exporting CSV:', error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      onClick={handleExport}
      disabled={disabled || isExporting || !data || data.length === 0}
      variant="outline"
      size="sm"
    >
      <Download className="h-4 w-4 mr-2" />
      {isExporting ? 'Exporting...' : 'Export CSV'}
    </Button>
  )
}