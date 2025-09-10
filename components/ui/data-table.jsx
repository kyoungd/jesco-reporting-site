'use client'

import { useState, useMemo } from 'react'
import { ChevronUpIcon, ChevronDownIcon, ArrowUpDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ENTRY_STATUS } from '@/lib/constants'

const StatusBadge = ({ status, className }) => {
  const statusStyles = {
    [ENTRY_STATUS.DRAFT]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    [ENTRY_STATUS.POSTED]: 'bg-green-100 text-green-800 border-green-200',
    default: 'bg-gray-100 text-gray-800 border-gray-200'
  }

  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
      statusStyles[status] || statusStyles.default,
      className
    )}>
      {status || 'Unknown'}
    </span>
  )
}

const SortButton = ({ column, sortConfig, onSort }) => {
  const { key, direction } = sortConfig || {}
  
  return (
    <button
      className="inline-flex items-center gap-1 hover:bg-gray-50 p-1 rounded transition-colors"
      onClick={() => onSort(column)}
    >
      {key === column ? (
        direction === 'asc' ? (
          <ChevronUpIcon className="h-4 w-4" />
        ) : (
          <ChevronDownIcon className="h-4 w-4" />
        )
      ) : (
        <ArrowUpDownIcon className="h-4 w-4 opacity-50" />
      )}
    </button>
  )
}

const TableHeader = ({ columns, sortConfig, onSort }) => {
  return (
    <thead className="bg-gray-50">
      <tr>
        {columns.map((column) => (
          <th
            key={column.key}
            className={cn(
              'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
              column.sortable && 'cursor-pointer hover:bg-gray-100'
            )}
          >
            <div className="flex items-center justify-between">
              <span>{column.label}</span>
              {column.sortable && (
                <SortButton 
                  column={column.key}
                  sortConfig={sortConfig}
                  onSort={onSort}
                />
              )}
            </div>
          </th>
        ))}
      </tr>
    </thead>
  )
}

const TableRow = ({ item, columns, onRowClick, isClickable }) => {
  return (
    <tr 
      className={cn(
        'bg-white',
        isClickable && 'hover:bg-gray-50 cursor-pointer',
        'border-b border-gray-200'
      )}
      onClick={() => onRowClick?.(item)}
    >
      {columns.map((column) => (
        <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {column.render ? (
            column.render(item)
          ) : column.key === 'entryStatus' || column.key === 'status' ? (
            <StatusBadge status={item[column.key]} />
          ) : (
            item[column.key] || '-'
          )}
        </td>
      ))}
    </tr>
  )
}

const SearchInput = ({ value, onChange, placeholder = 'Search...' }) => {
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
      />
    </div>
  )
}

const FilterSelect = ({ value, onChange, options, placeholder = 'Filter...' }) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

const Pagination = ({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }) => {
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  const getVisiblePages = () => {
    const delta = 2
    const range = []
    const rangeWithDots = []

    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i)
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...')
    } else {
      rangeWithDots.push(1)
    }

    rangeWithDots.push(...range)

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages)
    } else {
      rangeWithDots.push(totalPages)
    }

    return rangeWithDots
  }

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between px-6 py-3 bg-white border-t border-gray-200">
      <div className="flex-1 flex justify-between sm:hidden">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Showing <span className="font-medium">{startItem}</span> to <span className="font-medium">{endItem}</span> of{' '}
            <span className="font-medium">{totalItems}</span> results
          </p>
        </div>
        <div>
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {getVisiblePages().map((page, index) => (
              <button
                key={index}
                onClick={() => typeof page === 'number' && onPageChange(page)}
                disabled={page === '...'}
                className={cn(
                  'relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium',
                  page === currentPage
                    ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                    : 'bg-white text-gray-500 hover:bg-gray-50',
                  page === '...' && 'cursor-default'
                )}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </nav>
        </div>
      </div>
    </div>
  )
}

export function DataTable({
  data = [],
  columns = [],
  searchable = true,
  searchPlaceholder = 'Search...',
  filterable = false,
  filterOptions = [],
  filterPlaceholder = 'Filter...',
  sortable = true,
  pagination = true,
  itemsPerPage = 10,
  onRowClick,
  loading = false,
  emptyMessage = 'No data available',
  className
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterValue, setFilterValue] = useState('')
  const [sortConfig, setSortConfig] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)

  const filteredAndSortedData = useMemo(() => {
    let result = [...data]

    if (searchable && searchTerm) {
      result = result.filter(item =>
        Object.values(item).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    }

    if (filterable && filterValue) {
      result = result.filter(item => {
        const filterColumn = filterOptions.find(opt => opt.value === filterValue)?.key
        if (filterColumn) {
          return item[filterColumn] === filterValue
        }
        return true
      })
    }

    if (sortable && sortConfig) {
      result.sort((a, b) => {
        const { key, direction } = sortConfig
        const aValue = a[key]
        const bValue = b[key]

        if (aValue === null || aValue === undefined) return 1
        if (bValue === null || bValue === undefined) return -1

        if (aValue < bValue) return direction === 'asc' ? -1 : 1
        if (aValue > bValue) return direction === 'asc' ? 1 : -1
        return 0
      })
    }

    return result
  }, [data, searchTerm, filterValue, sortConfig, searchable, filterable, sortable, filterOptions])

  const paginatedData = useMemo(() => {
    if (!pagination) return filteredAndSortedData
    
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredAndSortedData.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredAndSortedData, currentPage, itemsPerPage, pagination])

  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage)

  const handleSort = (column) => {
    if (!sortable) return
    
    setSortConfig(prev => {
      if (prev?.key === column) {
        return prev.direction === 'asc' 
          ? { key: column, direction: 'desc' }
          : null
      }
      return { key: column, direction: 'asc' }
    })
  }

  const handlePageChange = (page) => {
    setCurrentPage(page)
  }

  const resetFilters = () => {
    setSearchTerm('')
    setFilterValue('')
    setSortConfig(null)
    setCurrentPage(1)
  }

  if (loading) {
    return (
      <div className={cn('bg-white shadow overflow-hidden rounded-md', className)}>
        <div className="px-6 py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('bg-white shadow overflow-hidden rounded-md', className)}>
      {(searchable || filterable) && (
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col sm:flex-row gap-4">
            {searchable && (
              <div className="flex-1">
                <SearchInput
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder={searchPlaceholder}
                />
              </div>
            )}
            {filterable && filterOptions.length > 0 && (
              <div className="sm:w-48">
                <FilterSelect
                  value={filterValue}
                  onChange={setFilterValue}
                  options={filterOptions}
                  placeholder={filterPlaceholder}
                />
              </div>
            )}
            {(searchTerm || filterValue || sortConfig) && (
              <button
                onClick={resetFilters}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <TableHeader
            columns={columns}
            sortConfig={sortConfig}
            onSort={handleSort}
          />
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.length > 0 ? (
              paginatedData.map((item, index) => (
                <TableRow
                  key={item.id || index}
                  item={item}
                  columns={columns}
                  onRowClick={onRowClick}
                  isClickable={!!onRowClick}
                />
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-12 text-center text-sm text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {pagination && paginatedData.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          totalItems={filteredAndSortedData.length}
          itemsPerPage={itemsPerPage}
        />
      )}
    </div>
  )
}

export { StatusBadge }