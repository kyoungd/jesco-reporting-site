'use client'

import { useState, useEffect } from 'react'
import { requireRole } from '@/lib/permissions'
import { logInfo, logError } from '@/lib/logging'
import { useRouter } from 'next/navigation'

function BackupInstructionsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('database')
  const router = useRouter()

  useEffect(() => {
    checkPermissionAndInit()
  }, [])

  async function checkPermissionAndInit() {
    try {
      // Check L5 admin permission using existing function
      const hasPermission = await requireRole('L5')
      if (!hasPermission) {
        router.push('/unauthorized')
        return
      }
      
      logInfo('Backup instructions page accessed', { 
        component: 'BackupInstructionsPage' 
      })
      
      setLoading(false)
    } catch (error) {
      logError(error, { component: 'BackupInstructionsPage', action: 'permission_check' })
      setError('Permission check failed')
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading backup instructions...</p>
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

  const tabs = [
    { id: 'database', name: 'Database Backup', icon: '🗃️' },
    { id: 'files', name: 'File System', icon: '📁' },
    { id: 'configuration', name: 'Configuration', icon: '⚙️' },
    { id: 'recovery', name: 'Disaster Recovery', icon: '🔄' }
  ]

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Backup & Recovery Instructions</h1>
              <p className="text-gray-600 mt-2">Critical system backup procedures and recovery protocols</p>
            </div>
            <div className="flex items-center space-x-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                L5 Admin Access
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                🔒 Confidential
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="bg-white shadow rounded-lg">
          {/* Database Backup Tab */}
          {activeTab === 'database' && (
            <div className="p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-3">Database Backup Procedures</h2>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start">
                    <svg className="h-5 w-5 text-yellow-400 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h3 className="text-sm font-medium text-yellow-800">Critical Notice</h3>
                      <p className="text-sm text-yellow-700 mt-1">Always perform backups during maintenance windows to ensure data consistency.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Daily Automated Backup</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Production Database Dump</h4>
                    <pre className="bg-gray-800 text-green-400 p-4 rounded text-sm overflow-x-auto mb-3">
{`#!/bin/bash
# Daily backup script - runs via cron at 2:00 AM UTC

export PGPASSWORD="$DATABASE_PASSWORD"
BACKUP_DIR="/backups/postgresql/$(date +%Y/%m)"
BACKUP_FILE="jesco_db_$(date +%Y%m%d_%H%M%S).sql"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create database dump
pg_dump -h $DATABASE_HOST -U $DATABASE_USER -d $DATABASE_NAME \\
  --verbose --clean --create --if-exists \\
  --format=custom --compress=9 \\
  --file="$BACKUP_DIR/$BACKUP_FILE"

# Verify backup integrity
pg_restore --list "$BACKUP_DIR/$BACKUP_FILE" > /dev/null

if [ $? -eq 0 ]; then
  echo "✅ Backup successful: $BACKUP_FILE"
  
  # Upload to cloud storage
  aws s3 cp "$BACKUP_DIR/$BACKUP_FILE" \\
    "s3://jesco-backups/database/$(date +%Y/%m)/"
  
  # Log success
  curl -X POST $WEBHOOK_URL -d "Backup completed: $BACKUP_FILE"
else
  echo "❌ Backup failed"
  exit 1
fi`}
                    </pre>
                    <p className="text-sm text-gray-600">
                      <strong>Cron Schedule:</strong> <code>0 2 * * * /scripts/backup-database.sh</code>
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Manual Backup Commands</h3>
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Full Database Backup</h4>
                      <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`pg_dump -h localhost -U jesco_user -d jesco_db \\
  --format=custom --compress=9 \\
  --file=backup_$(date +%Y%m%d).dump`}
                      </pre>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Schema-Only Backup</h4>
                      <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`pg_dump -h localhost -U jesco_user -d jesco_db \\
  --schema-only --format=custom \\
  --file=schema_$(date +%Y%m%d).dump`}
                      </pre>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Data-Only Backup</h4>
                      <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`pg_dump -h localhost -U jesco_user -d jesco_db \\
  --data-only --format=custom \\
  --file=data_$(date +%Y%m%d).dump`}
                      </pre>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Backup retention Policy</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <ul className="space-y-2 text-sm text-blue-800">
                      <li>• <strong>Daily backups:</strong> Retained for 30 days</li>
                      <li>• <strong>Weekly backups:</strong> Retained for 12 weeks</li>
                      <li>• <strong>Monthly backups:</strong> Retained for 12 months</li>
                      <li>• <strong>Yearly backups:</strong> Retained for 7 years</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* File System Tab */}
          {activeTab === 'files' && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Application Files & Assets</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Critical Directories</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <pre className="text-sm text-gray-800 whitespace-pre-wrap">
{`/app/jesco-site/           # Next.js application root
├── .env.production         # Environment variables
├── lib/                    # Core business logic
├── app/                    # Application routes
├── components/             # Reusable components  
├── prisma/                 # Database schema
├── uploads/                # User uploaded files
└── certificates/           # SSL certificates`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">File Backup Script</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <pre className="bg-gray-800 text-green-400 p-4 rounded text-sm overflow-x-auto">
{`#!/bin/bash
# Application files backup script

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR="/app/jesco-site"
BACKUP_DIR="/backups/files"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup application files (excluding node_modules and .next)
tar -czf "$BACKUP_DIR/app_files_$BACKUP_DATE.tar.gz" \\
  --exclude="node_modules" \\
  --exclude=".next" \\
  --exclude="coverage" \\
  --exclude="*.log" \\
  -C "$(dirname $APP_DIR)" \\
  "$(basename $APP_DIR)"

# Backup uploads separately
tar -czf "$BACKUP_DIR/uploads_$BACKUP_DATE.tar.gz" \\
  -C "$APP_DIR" uploads/

# Upload to S3
aws s3 cp "$BACKUP_DIR/app_files_$BACKUP_DATE.tar.gz" \\
  "s3://jesco-backups/files/"
  
aws s3 cp "$BACKUP_DIR/uploads_$BACKUP_DATE.tar.gz" \\
  "s3://jesco-backups/files/"`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">SSL Certificates</h3>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <svg className="h-5 w-5 text-yellow-400 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-4 2V8a6 6 0 016-6h2a6 6 0 016 6z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <h4 className="font-medium text-yellow-800">Certificate Backup</h4>
                        <p className="text-sm text-yellow-700 mt-1">
                          SSL certificates are automatically renewed via Let's Encrypt. 
                          Manual backups stored in <code>/etc/letsencrypt/</code>
                        </p>
                        <pre className="bg-yellow-100 text-yellow-900 p-2 rounded text-xs mt-2 overflow-x-auto">
{`sudo tar -czf ssl_backup_$(date +%Y%m%d).tar.gz /etc/letsencrypt/`}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Configuration Tab */}
          {activeTab === 'configuration' && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">System Configuration Backup</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Environment Variables</h3>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start">
                      <svg className="h-5 w-5 text-red-400 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <h4 className="font-medium text-red-800">Security Warning</h4>
                        <p className="text-sm text-red-700 mt-1">
                          Never store production secrets in plain text. Use encrypted storage or secure vaults.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Environment Template Backup</h4>
                    <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`# Create sanitized environment template
cp .env.production .env.template

# Remove sensitive values, keep structure
sed -i 's/=.*/=REDACTED/' .env.template

# Backup configuration structure
tar -czf config_$(date +%Y%m%d).tar.gz \\
  .env.template \\
  next.config.js \\
  jest.config.js \\
  prisma/schema.prisma \\
  middleware.js`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">System Services</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Systemd Services</h4>
                      <pre className="bg-gray-800 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`# Backup service files
sudo tar -czf services_backup.tar.gz \\
  /etc/systemd/system/jesco-*.service
  
# Export service status
systemctl list-units --type=service \\
  --state=running > running_services.txt`}
                      </pre>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Nginx Configuration</h4>
                      <pre className="bg-gray-800 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`# Backup Nginx config
sudo tar -czf nginx_config.tar.gz \\
  /etc/nginx/sites-available/ \\
  /etc/nginx/nginx.conf
  
# Test configuration
sudo nginx -t`}
                      </pre>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Database Configuration</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`# PostgreSQL configuration backup
sudo tar -czf postgres_config.tar.gz \\
  /etc/postgresql/*/main/postgresql.conf \\
  /etc/postgresql/*/main/pg_hba.conf \\
  /etc/postgresql/*/main/pg_ident.conf

# Backup database users and roles
pg_dumpall -h localhost -U postgres --roles-only \\
  --file=roles_$(date +%Y%m%d).sql`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recovery Tab */}
          {activeTab === 'recovery' && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Disaster Recovery Procedures</h2>
              
              <div className="space-y-8">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <svg className="h-6 w-6 text-red-500 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h3 className="text-lg font-medium text-red-800">Emergency Contact Information</h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p><strong>Primary DBA:</strong> +1-555-0123 (available 24/7)</p>
                        <p><strong>DevOps Lead:</strong> +1-555-0124</p>
                        <p><strong>AWS Support:</strong> Enterprise Support Case</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Recovery Priority Matrix</h3>
                  <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Component</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RTO</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RPO</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Database</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">4 hours</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">1 hour</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Critical
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Application</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">2 hours</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">4 hours</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Critical
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">File Storage</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">8 hours</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">24 hours</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              High
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Database Recovery Procedures</h3>
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Step 1: Assess Damage</h4>
                      <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`# Check database accessibility
pg_isready -h $DB_HOST -p $DB_PORT

# Check disk space
df -h /var/lib/postgresql/

# Review PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log`}
                      </pre>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Step 2: Stop Application</h4>
                      <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`# Stop Next.js application
sudo systemctl stop jesco-app

# Verify no connections to database
SELECT count(*) FROM pg_stat_activity 
WHERE datname = 'jesco_db';`}
                      </pre>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Step 3: Restore from Backup</h4>
                      <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`# Download latest backup from S3
aws s3 cp s3://jesco-backups/database/latest.dump ./

# Drop existing database (if corrupted)
dropdb -h localhost -U postgres jesco_db

# Restore from backup
pg_restore -h localhost -U postgres \\
  --create --verbose --clean \\
  --dbname=postgres latest.dump

# Verify restoration
psql -h localhost -U jesco_user -d jesco_db \\
  -c "SELECT count(*) FROM client_profiles;"`}
                      </pre>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Step 4: Validate and Restart</h4>
                      <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`# Run database integrity checks
psql -d jesco_db -c "SELECT * FROM pg_stat_database;"

# Start application
sudo systemctl start jesco-app

# Monitor application logs
sudo journalctl -u jesco-app -f

# Verify application functionality
curl -f https://app.jesco.com/api/health`}
                      </pre>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Post-Recovery Checklist</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center">
                        <input type="checkbox" className="h-4 w-4 text-blue-600 rounded mr-3" />
                        <span>Database connectivity verified</span>
                      </div>
                      <div className="flex items-center">
                        <input type="checkbox" className="h-4 w-4 text-blue-600 rounded mr-3" />
                        <span>Application services running</span>
                      </div>
                      <div className="flex items-center">
                        <input type="checkbox" className="h-4 w-4 text-blue-600 rounded mr-3" />
                        <span>SSL certificates valid</span>
                      </div>
                      <div className="flex items-center">
                        <input type="checkbox" className="h-4 w-4 text-blue-600 rounded mr-3" />
                        <span>User authentication working</span>
                      </div>
                      <div className="flex items-center">
                        <input type="checkbox" className="h-4 w-4 text-blue-600 rounded mr-3" />
                        <span>Report generation functional</span>
                      </div>
                      <div className="flex items-center">
                        <input type="checkbox" className="h-4 w-4 text-blue-600 rounded mr-3" />
                        <span>Backup systems re-enabled</span>
                      </div>
                      <div className="flex items-center">
                        <input type="checkbox" className="h-4 w-4 text-blue-600 rounded mr-3" />
                        <span>Stakeholders notified</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BackupInstructionsPage