'use client'

import { useState, useEffect } from 'react'
import { requireRole } from '@/lib/permissions'
import { logInfo, logError, logMetric } from '@/lib/logging'
import { useRouter } from 'next/navigation'
import { calculateAUM } from '@/lib/calculations/aum'
import { calculateTWR } from '@/lib/calculations/twr'

function QualityControlDashboard() {
  const [qcData, setQcData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  useEffect(() => {
    checkPermissionAndLoadData()
  }, [])

  async function checkPermissionAndLoadData() {
    try {
      // Check L5 admin permission using existing function
      const hasPermission = await requireRole('L5')
      if (!hasPermission) {
        router.push('/unauthorized')
        return
      }
      await loadQualityMetrics()
    } catch (error) {
      logError(error, { component: 'QualityControlDashboard', action: 'permission_check' })
      setError('Permission check failed')
      setLoading(false)
    }
  }

  async function loadQualityMetrics() {
    try {
      setLoading(true)
      
      // Fetch quality control data from API
      const response = await fetch('/api/quality/metrics')
      if (!response.ok) throw new Error('Failed to load quality metrics')
      
      const data = await response.json()
      setQcData(data)
      
      logInfo('Quality metrics dashboard viewed', { 
        component: 'QualityControlDashboard',
        metricsCount: Object.keys(data).length
      })
      
      // Log key metrics for monitoring
      if (data.dataIntegrity?.errorRate) {
        logMetric('data_integrity_error_rate', data.dataIntegrity.errorRate, {
          component: 'QualityControlDashboard'
        })
      }
      
    } catch (error) {
      logError(error, { component: 'QualityControlDashboard', action: 'load_metrics' })
      setError('Failed to load quality metrics')
    } finally {
      setLoading(false)
    }
  }

  async function refreshMetrics() {
    try {
      setRefreshing(true)
      await loadQualityMetrics()
      logInfo('Quality metrics manually refreshed', { 
        component: 'QualityControlDashboard' 
      })
    } catch (error) {
      logError(error, { component: 'QualityControlDashboard', action: 'manual_refresh' })
    } finally {
      setRefreshing(false)
    }
  }

  async function runDataIntegrityCheck() {
    try {
      setRefreshing(true)
      
      const response = await fetch('/api/quality/integrity-check', {
        method: 'POST'
      })
      
      if (!response.ok) throw new Error('Integrity check failed')
      
      const result = await response.json()
      await loadQualityMetrics() // Refresh data
      
      logInfo('Data integrity check completed', { 
        component: 'QualityControlDashboard',
        issues: result.issuesFound 
      })
      
    } catch (error) {
      logError(error, { component: 'QualityControlDashboard', action: 'integrity_check' })
      setError('Failed to run integrity check')
    } finally {
      setRefreshing(false)
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case 'good': return 'bg-green-100 text-green-800 border-green-200'
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'error': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  function getStatusIcon(status) {
    switch (status) {
      case 'good':
        return (
          <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )
      case 'warning':
        return (
          <svg className="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )
      case 'error':
        return (
          <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        )
      default:
        return (
          <svg className="h-5 w-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        )
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quality control metrics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <div className="flex items-center mb-3">
            <svg className="h-5 w-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <h3 className="text-red-800 font-medium">Error</h3>
          </div>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Quality Control Dashboard</h1>
              <p className="text-gray-600 mt-2">System health and data quality monitoring</p>
            </div>
            <div className="flex items-center space-x-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                L5 Admin Access
              </span>
              <button
                onClick={refreshMetrics}
                disabled={refreshing}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {refreshing ? (
                  <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
                ) : (
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                Refresh
              </button>
              <button
                onClick={runDataIntegrityCheck}
                disabled={refreshing}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Run Integrity Check
              </button>
            </div>
          </div>
        </div>

        {qcData && (
          <div className="space-y-6">
            {/* System Health Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {qcData.systemHealth && Object.entries(qcData.systemHealth).map(([metric, data]) => (
                <div key={metric} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 capitalize">{metric.replace(/([A-Z])/g, ' $1').trim()}</p>
                      <p className="text-2xl font-semibold text-gray-900">{data.value}</p>
                    </div>
                    {getStatusIcon(data.status)}
                  </div>
                  <div className={`mt-3 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(data.status)}`}>
                    {data.status.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>

            {/* Data Integrity */}
            {qcData.dataIntegrity && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Data Integrity</h2>
                  <p className="text-gray-600 text-sm">Database consistency and validation results</p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-gray-900">{qcData.dataIntegrity.totalRecords}</div>
                      <div className="text-sm text-gray-600">Total Records</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-600">{qcData.dataIntegrity.errorCount}</div>
                      <div className="text-sm text-gray-600">Data Errors</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">
                        {((qcData.dataIntegrity.totalRecords - qcData.dataIntegrity.errorCount) / qcData.dataIntegrity.totalRecords * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-600">Data Quality</div>
                    </div>
                  </div>
                  
                  {qcData.dataIntegrity.issues && qcData.dataIntegrity.issues.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-sm font-medium text-gray-900 mb-3">Recent Issues</h3>
                      <div className="space-y-2">
                        {qcData.dataIntegrity.issues.slice(0, 5).map((issue, index) => (
                          <div key={index} className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
                            <svg className="h-5 w-5 text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            <div>
                              <p className="text-sm font-medium text-red-800">{issue.type}</p>
                              <p className="text-sm text-red-700">{issue.description}</p>
                              {issue.recordId && (
                                <p className="text-xs text-red-600 font-mono">Record: {issue.recordId}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Calculation Accuracy */}
            {qcData.calculationAccuracy && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Calculation Accuracy</h2>
                  <p className="text-gray-600 text-sm">AUM and TWR calculation validation results</p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-gray-900">AUM Calculations</h3>
                        {getStatusIcon(qcData.calculationAccuracy.aum.status)}
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Tests Run:</span>
                          <span className="font-medium">{qcData.calculationAccuracy.aum.testsRun}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Passed:</span>
                          <span className="font-medium text-green-600">{qcData.calculationAccuracy.aum.passed}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Failed:</span>
                          <span className="font-medium text-red-600">{qcData.calculationAccuracy.aum.failed}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Accuracy:</span>
                          <span className="font-medium">{qcData.calculationAccuracy.aum.accuracy}%</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-gray-900">TWR Calculations</h3>
                        {getStatusIcon(qcData.calculationAccuracy.twr.status)}
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Tests Run:</span>
                          <span className="font-medium">{qcData.calculationAccuracy.twr.testsRun}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Passed:</span>
                          <span className="font-medium text-green-600">{qcData.calculationAccuracy.twr.passed}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Failed:</span>
                          <span className="font-medium text-red-600">{qcData.calculationAccuracy.twr.failed}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Accuracy:</span>
                          <span className="font-medium">{qcData.calculationAccuracy.twr.accuracy}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* System Performance */}
            {qcData.performance && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">System Performance</h2>
                  <p className="text-gray-600 text-sm">Application response times and resource usage</p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{qcData.performance.avgResponseTime}ms</div>
                      <div className="text-sm text-gray-600">Avg Response Time</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{qcData.performance.dbQueryTime}ms</div>
                      <div className="text-sm text-gray-600">DB Query Time</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{qcData.performance.memoryUsage}%</div>
                      <div className="text-sm text-gray-600">Memory Usage</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{qcData.performance.uptime}</div>
                      <div className="text-sm text-gray-600">Uptime</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 text-center text-sm text-gray-500">
          Last updated: {new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
    </div>
  )
}

export default QualityControlDashboard