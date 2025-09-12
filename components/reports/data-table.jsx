'use client'

import { useState } from 'react'

export default function DataTable({ columns, data }) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' })

  const sortedData = [...data].sort((a, b) => {
    if (sortConfig.key) {
      const aValue = a[sortConfig.key]
      const bValue = b[sortConfig.key]
      if (aValue < bValue) {
        return sortConfig.direction === 'ascending' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'ascending' ? 1 : -1
      }
    }
    return 0
  })

  const handleSort = (key) => {
    let direction = 'ascending'
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending'
    }
    setSortConfig({ key, direction })
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No data available</p>
      </div>
    )
  }

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          {columns.map((column) => (
            <th
              key={column.key}
              onClick={() => column.sortable && handleSort(column.key)}
              className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
              }`}
            >
              {column.header}
              {column.sortable && sortConfig.key === column.key && (
                <span className="ml-2">
                  {sortConfig.direction === 'ascending' ? '↑' : '↓'}
                </span>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {sortedData.map((row, index) => (
          <tr key={index} role="row">
            {columns.map((column) => (
              <td key={column.key} className="px-6 py-4 whitespace-nowrap">
                {column.format ? column.format(row[column.key]) : row[column.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}