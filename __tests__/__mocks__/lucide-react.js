// Mock lucide-react icons
const React = require('react')

module.exports = {
  Download: function Download() {
    return React.createElement('svg', { 'data-testid': 'download-icon' })
  },
  Calendar: function Calendar() {
    return React.createElement('svg', { 'data-testid': 'calendar-icon' })
  },
  Filter: function Filter() {
    return React.createElement('svg', { 'data-testid': 'filter-icon' })
  },
  BarChart: function BarChart() {
    return React.createElement('svg', { 'data-testid': 'barchart-icon' })
  },
  TrendingUp: function TrendingUp() {
    return React.createElement('svg', { 'data-testid': 'trendingup-icon' })
  }
}