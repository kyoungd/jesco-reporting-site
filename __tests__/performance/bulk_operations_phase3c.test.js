import { beforeEach, afterEach, describe, test, expect, jest } from '@jest/globals';
import { performance } from 'perf_hooks';
import { PrismaClient } from '@prisma/client';
import { createBulkTransactions, processBulkImport } from '../../lib/transactions';
import { createTestAccount, createTestSecurity, cleanupTestData, createTestOrg } from '../utils/test_helpers_phase3c';

const prisma = new PrismaClient();

describe('Phase 3C Bulk Operations Performance Tests', () => {
  let testOrgId;
  let testAccountId;
  let testSecurityId;
  let testUserId;

  beforeEach(async () => {
    const testData = await createTestOrg();
    testOrgId = testData.orgId;
    testUserId = testData.userId;
    testAccountId = await createTestAccount(testOrgId);
    testSecurityId = await createTestSecurity();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  test('bulk transaction creation performance - 1000 records', async () => {
    const transactionCount = 1000;
    const transactions = Array.from({ length: transactionCount }, (_, index) => ({
      organizationId: testOrgId,
      accountId: testAccountId,
      transactionDate: new Date('2024-01-15'),
      transactionType: 'BUY',
      securityId: testSecurityId,
      quantity: 100 + index,
      price: 50.25 + (index * 0.01),
      amount: (100 + index) * (50.25 + (index * 0.01)),
      description: `Bulk test transaction ${index + 1}`,
      entryStatus: 'APPROVED',
      userId: testUserId
    }));

    const startTime = performance.now();
    
    const result = await createBulkTransactions(transactions, testUserId, testOrgId);
    
    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(result.success).toBe(true);
    expect(result.created).toBe(transactionCount);
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    
    console.log(`Created ${transactionCount} transactions in ${duration.toFixed(2)}ms`);
    console.log(`Average time per transaction: ${(duration / transactionCount).toFixed(2)}ms`);
  }, 30000);

  test('bulk transaction creation performance - 5000 records', async () => {
    const transactionCount = 5000;
    const batchSize = 500;
    const transactions = Array.from({ length: transactionCount }, (_, index) => ({
      organizationId: testOrgId,
      accountId: testAccountId,
      transactionDate: new Date('2024-01-15'),
      transactionType: index % 2 === 0 ? 'BUY' : 'SELL',
      securityId: testSecurityId,
      quantity: 50 + (index % 100),
      price: 45.00 + (index % 50),
      amount: (50 + (index % 100)) * (45.00 + (index % 50)),
      description: `Large bulk test ${index + 1}`,
      entryStatus: 'APPROVED',
      userId: testUserId
    }));

    const startTime = performance.now();
    
    const result = await createBulkTransactions(transactions, testUserId, testOrgId, { batchSize });
    
    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(result.success).toBe(true);
    expect(result.created).toBe(transactionCount);
    expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
    
    console.log(`Created ${transactionCount} transactions in batches of ${batchSize} in ${duration.toFixed(2)}ms`);
    console.log(`Average time per transaction: ${(duration / transactionCount).toFixed(3)}ms`);
  }, 60000);

  test('bulk import CSV processing performance', async () => {
    const csvData = Array.from({ length: 2000 }, (_, index) => [
      '2024-01-15',
      index % 2 === 0 ? 'BUY' : 'SELL',
      'TEST',
      (100 + index).toString(),
      (50.25 + index * 0.01).toFixed(2),
      ((100 + index) * (50.25 + index * 0.01)).toFixed(2),
      `CSV bulk import test ${index + 1}`
    ]);

    const csvString = [
      'Date,Type,Security,Quantity,Price,Amount,Description',
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const startTime = performance.now();
    
    const result = await processBulkImport(csvString, testUserId, testOrgId, testAccountId);
    
    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(result.success).toBe(true);
    expect(result.processed).toBe(2000);
    expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    
    console.log(`Processed ${result.processed} CSV records in ${duration.toFixed(2)}ms`);
    console.log(`CSV parsing and validation rate: ${(result.processed / (duration / 1000)).toFixed(0)} records/second`);
  }, 45000);

  test('concurrent bulk operations performance', async () => {
    const concurrentOperations = 3;
    const recordsPerOperation = 500;

    const operations = Array.from({ length: concurrentOperations }, (_, opIndex) => {
      const transactions = Array.from({ length: recordsPerOperation }, (_, index) => ({
        organizationId: testOrgId,
        accountId: testAccountId,
        transactionDate: new Date('2024-01-15'),
        transactionType: 'BUY',
        securityId: testSecurityId,
        quantity: 100 + (opIndex * 1000) + index,
        price: 50.25 + (opIndex * 10) + (index * 0.01),
        amount: (100 + (opIndex * 1000) + index) * (50.25 + (opIndex * 10) + (index * 0.01)),
        description: `Concurrent op ${opIndex + 1} transaction ${index + 1}`,
        entryStatus: 'APPROVED',
        userId: testUserId
      }));
      
      return createBulkTransactions(transactions, testUserId, testOrgId);
    });

    const startTime = performance.now();
    
    const results = await Promise.all(operations);
    
    const endTime = performance.now();
    const duration = endTime - startTime;

    results.forEach((result, index) => {
      expect(result.success).toBe(true);
      expect(result.created).toBe(recordsPerOperation);
    });

    const totalRecords = concurrentOperations * recordsPerOperation;
    expect(duration).toBeLessThan(8000); // Should complete within 8 seconds
    
    console.log(`Completed ${concurrentOperations} concurrent operations (${totalRecords} total records) in ${duration.toFixed(2)}ms`);
    console.log(`Concurrent throughput: ${(totalRecords / (duration / 1000)).toFixed(0)} records/second`);
  }, 30000);

  test('database query performance under load', async () => {
    // Create test data
    const transactions = Array.from({ length: 1000 }, (_, index) => ({
      organizationId: testOrgId,
      accountId: testAccountId,
      transactionDate: new Date(2024, 0, 15 + (index % 30)),
      transactionType: index % 3 === 0 ? 'BUY' : (index % 3 === 1 ? 'SELL' : 'DIVIDEND'),
      securityId: testSecurityId,
      quantity: 100 + index,
      price: 50.25 + (index * 0.01),
      amount: (100 + index) * (50.25 + (index * 0.01)),
      description: `Query test transaction ${index + 1}`,
      entryStatus: index % 4 === 0 ? 'DRAFT' : (index % 4 === 1 ? 'PENDING' : 'APPROVED'),
      userId: testUserId
    }));

    await createBulkTransactions(transactions, testUserId, testOrgId);

    // Test various query patterns
    const queryTests = [
      {
        name: 'Simple pagination',
        query: () => prisma.transaction.findMany({
          where: { organizationId: testOrgId },
          take: 50,
          skip: 0,
          orderBy: { transactionDate: 'desc' }
        })
      },
      {
        name: 'Filtered by date range',
        query: () => prisma.transaction.findMany({
          where: {
            organizationId: testOrgId,
            transactionDate: {
              gte: new Date('2024-01-15'),
              lte: new Date('2024-01-31')
            }
          }
        })
      },
      {
        name: 'Aggregated by security',
        query: () => prisma.transaction.groupBy({
          by: ['securityId'],
          where: { organizationId: testOrgId },
          _sum: { quantity: true, amount: true },
          _count: { id: true }
        })
      },
      {
        name: 'Complex join with account',
        query: () => prisma.transaction.findMany({
          where: { organizationId: testOrgId },
          include: { account: true, security: true },
          take: 100
        })
      }
    ];

    for (const queryTest of queryTests) {
      const startTime = performance.now();
      
      const result = await queryTest.query();
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(Array.isArray(result)).toBe(true);
      expect(duration).toBeLessThan(500); // Each query should complete within 500ms
      
      console.log(`${queryTest.name}: ${duration.toFixed(2)}ms (${result.length} records)`);
    }
  }, 20000);

  test('memory usage during bulk operations', async () => {
    const initialMemory = process.memoryUsage();
    const transactionCount = 2000;

    const transactions = Array.from({ length: transactionCount }, (_, index) => ({
      organizationId: testOrgId,
      accountId: testAccountId,
      transactionDate: new Date('2024-01-15'),
      transactionType: 'BUY',
      securityId: testSecurityId,
      quantity: 100 + index,
      price: 50.25 + (index * 0.01),
      amount: (100 + index) * (50.25 + (index * 0.01)),
      description: `Memory test transaction ${index + 1}`,
      entryStatus: 'APPROVED',
      userId: testUserId
    }));

    await createBulkTransactions(transactions, testUserId, testOrgId);

    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryPerRecord = memoryIncrease / transactionCount;

    console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Memory per record: ${(memoryPerRecord / 1024).toFixed(2)} KB`);
    
    // Memory increase should be reasonable (less than 100MB for 2000 records)
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
  }, 30000);

  test('transaction rollback performance', async () => {
    const transactionCount = 1000;
    const invalidTransactions = Array.from({ length: transactionCount }, (_, index) => ({
      organizationId: testOrgId,
      accountId: testAccountId,
      transactionDate: new Date('2024-01-15'),
      transactionType: 'BUY',
      securityId: testSecurityId,
      quantity: 100 + index,
      price: 50.25 + (index * 0.01),
      amount: (100 + index) * (50.25 + (index * 0.01)),
      description: `Rollback test transaction ${index + 1}`,
      entryStatus: 'APPROVED',
      userId: index === 999 ? 'invalid-user-id' : testUserId // Last transaction will fail
    }));

    const startTime = performance.now();
    
    const result = await createBulkTransactions(invalidTransactions, testUserId, testOrgId);
    
    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(result.success).toBe(false);
    expect(result.created).toBe(0); // No transactions should be created due to rollback
    expect(duration).toBeLessThan(3000); // Rollback should be fast
    
    console.log(`Rollback of ${transactionCount} transactions completed in ${duration.toFixed(2)}ms`);

    // Verify no transactions were actually created
    const count = await prisma.transaction.count({
      where: { organizationId: testOrgId }
    });
    expect(count).toBe(0);
  }, 20000);
});