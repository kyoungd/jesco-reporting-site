'use client'

import { useState, useEffect } from 'react'
import { getViewableClients } from '@/lib/permissions'
import { db } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'

export default function ReportFilters({ 
  user, 
  onFiltersChange, 
  showAccountFilter = true, 
  showDateRange = true,
  showClientFilter = true,
  defaultStartDate = null,
  defaultEndDate = null 
}) {
  const [clients, setClients] = useState([])
  const [accounts, setAccounts] = useState([])
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedAccount, setSelectedAccount] = useState('')
  const [startDate, setStartDate] = useState(defaultStartDate || '')
  const [endDate, setEndDate] = useState(defaultEndDate || '')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadClients()
  }, [user])

  useEffect(() => {
    if (selectedClient) {
      loadAccounts(selectedClient)
    } else {
      setAccounts([])
      setSelectedAccount('')
    }
  }, [selectedClient])

  const loadClients = async () => {
    try {
      setLoading(true)
      const viewableClientIds = await getViewableClients(user)
      
      if (viewableClientIds.length > 0) {
        const clientsData = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientIds: viewableClientIds })
        })
        const clientsResult = await clientsData.json()
        setClients(clientsResult.clients || [])
      }
    } catch (error) {
      console.error('Error loading clients:', error)
      setClients([])
    } finally {
      setLoading(false)
    }
  }

  const loadAccounts = async (clientId) => {
    try {
      const response = await fetch(`/api/accounts?clientId=${clientId}`)
      const data = await response.json()
      setAccounts(data.accounts || [])
    } catch (error) {
      console.error('Error loading accounts:', error)
      setAccounts([])
    }
  }

  const handleApplyFilters = () => {
    const filters = {}
    
    if (showClientFilter && selectedClient) {
      filters.clientId = selectedClient
    }
    
    if (showAccountFilter && selectedAccount) {
      filters.accountId = selectedAccount
    }
    
    if (showDateRange) {
      if (startDate) filters.startDate = new Date(startDate)
      if (endDate) filters.endDate = new Date(endDate)
    }
    
    onFiltersChange(filters)
  }

  const handleReset = () => {
    setSelectedClient('')
    setSelectedAccount('')
    setStartDate(defaultStartDate || '')
    setEndDate(defaultEndDate || '')
    onFiltersChange({})
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-center">Loading filters...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          {showClientFilter && (
            <div>
              <Label htmlFor="client">Client</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.companyName || client.contactName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showAccountFilter && (
            <div>
              <Label htmlFor="account">Account</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount} disabled={!selectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.accountNumber} - {account.accountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showDateRange && (
            <>
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="flex gap-2">
            <Button onClick={handleApplyFilters}>Apply Filters</Button>
            <Button variant="outline" onClick={handleReset}>Reset</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}