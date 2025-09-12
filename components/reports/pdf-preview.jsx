/**
 * PDF Preview Component - NEW COMPONENT
 * 
 * CONSTRAINTS:
 * - Display component only
 * - Receives props, shows preview
 * - NO business logic
 * - NO direct calculation calls
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Download, FileText, Calendar, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

export default function PDFPreview({ clients, defaultQuarter, defaultYear }) {
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedQuarter, setSelectedQuarter] = useState(defaultQuarter?.toString() || '1')
  const [selectedYear, setSelectedYear] = useState(defaultYear?.toString() || new Date().getFullYear().toString())
  const [reportType, setReportType] = useState('quarterly')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState(null)

  const handleGenerate = async () => {
    if (!selectedClient) {
      setGenerationStatus({ type: 'error', message: 'Please select a client' })
      return
    }

    if (reportType === 'quarterly' && (!selectedQuarter || !selectedYear)) {
      setGenerationStatus({ type: 'error', message: 'Please select quarter and year' })
      return
    }

    setIsGenerating(true)
    setGenerationStatus(null)

    try {
      const requestBody = {
        clientId: selectedClient,
        reportType
      }

      if (reportType === 'quarterly') {
        requestBody.quarter = parseInt(selectedQuarter)
        requestBody.year = parseInt(selectedYear)
      }

      const response = await fetch('/api/reports/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate PDF')
      }

      // Get the PDF blob
      const blob = await response.blob()
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      // Get filename from response headers or create default
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = 'report.pdf'
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="([^"]*)"/)
        if (match) {
          filename = match[1]
        }
      }
      
      link.download = filename
      document.body.appendChild(link)
      link.click()
      
      // Cleanup
      window.URL.revokeObjectURL(url)
      document.body.removeChild(link)
      
      setGenerationStatus({ 
        type: 'success', 
        message: `PDF report "${filename}" downloaded successfully` 
      })

    } catch (error) {
      console.error('PDF generation error:', error)
      setGenerationStatus({ 
        type: 'error', 
        message: error.message || 'Failed to generate PDF report' 
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const selectedClientName = clients.find(c => c.id === selectedClient)?.name || ''

  return (
    <div className="space-y-6">
      {/* Client Selection */}
      <div className="space-y-2">
        <Label htmlFor="client-select">Select Client</Label>
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger id="client-select">
            <SelectValue placeholder="Choose a client..." />
          </SelectTrigger>
          <SelectContent>
            {clients.map(client => (
              <SelectItem key={client.id} value={client.id}>
                <div className="flex items-center gap-2">
                  <span>{client.name}</span>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {client.level}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Report Type Selection */}
      <div className="space-y-2">
        <Label htmlFor="report-type">Report Type</Label>
        <Select value={reportType} onValueChange={setReportType}>
          <SelectTrigger id="report-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="quarterly">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <div>
                  <div className="font-medium">Quarterly Report</div>
                  <div className="text-xs text-gray-500">Comprehensive quarterly analysis</div>
                </div>
              </div>
            </SelectItem>
            <SelectItem value="simple">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <div>
                  <div className="font-medium">Simple Statement</div>
                  <div className="text-xs text-gray-500">Basic client statement</div>
                </div>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quarter and Year Selection (only for quarterly reports) */}
      {reportType === 'quarterly' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="quarter-select">Quarter</Label>
            <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
              <SelectTrigger id="quarter-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Q1 (Jan - Mar)</SelectItem>
                <SelectItem value="2">Q2 (Apr - Jun)</SelectItem>
                <SelectItem value="3">Q3 (Jul - Sep)</SelectItem>
                <SelectItem value="4">Q4 (Oct - Dec)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="year-input">Year</Label>
            <Input
              id="year-input"
              type="number"
              min="2020"
              max={new Date().getFullYear() + 1}
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              placeholder="e.g., 2024"
            />
          </div>
        </div>
      )}

      {/* Preview Information */}
      {selectedClient && (
        <Card className="bg-gray-50">
          <CardContent className="pt-4">
            <h4 className="font-medium mb-2">Report Preview</h4>
            <div className="space-y-1 text-sm">
              <div><span className="font-medium">Client:</span> {selectedClientName}</div>
              <div><span className="font-medium">Type:</span> {reportType === 'quarterly' ? 'Quarterly Report' : 'Simple Statement'}</div>
              {reportType === 'quarterly' && (
                <div><span className="font-medium">Period:</span> Q{selectedQuarter} {selectedYear}</div>
              )}
              <div><span className="font-medium">Format:</span> PDF</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generation Status */}
      {generationStatus && (
        <Card className={`border ${
          generationStatus.type === 'error' 
            ? 'border-red-200 bg-red-50' 
            : 'border-green-200 bg-green-50'
        }`}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              {generationStatus.type === 'error' ? (
                <AlertCircle className="h-4 w-4 text-red-600" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
              <span className={`text-sm ${
                generationStatus.type === 'error' ? 'text-red-700' : 'text-green-700'
              }`}>
                {generationStatus.message}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate Button */}
      <Button 
        onClick={handleGenerate} 
        disabled={!selectedClient || isGenerating}
        className="w-full"
        size="lg"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating PDF...
          </>
        ) : (
          <>
            <Download className="h-4 w-4 mr-2" />
            Generate & Download PDF
          </>
        )}
      </Button>

      {/* Help Text */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>• PDF reports are generated using live data from the database</p>
        <p>• Quarterly reports include AUM analysis, performance metrics, and holdings details</p>
        <p>• Generated files are automatically downloaded to your device</p>
      </div>
    </div>
  )
}