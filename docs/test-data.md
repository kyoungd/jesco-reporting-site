 Based on my analysis of the input pages, here's the complete test data guide and entry sequence:

  Input Pages Test Data Guide

  1. CLIENTS (/clients/new) - FIRST

  Fields:
  - Company Name (required)
  - Contact Name
  - Email
  - Phone
  - Address fields
  - SEC DEX Code
  - Level (L2_CLIENT or L3_SUB_CLIENT)

  Test Data:
  Company Name: "Acme Investment Corp"
  Contact Name: "John Smith"
  Email: "john@acme.com"
  Phone: "555-123-4567"
  Address: "123 Main St"
  City: "New York"
  State: "NY"
  ZIP: "10001"
  SEC DEX Code: "ACME001"
  Level: "L2_CLIENT"

  2. ACCOUNTS (/accounts/new) - SECOND

  Fields:
  - Account Category (master/client)
  - Account Number (required)
  - Account Name (required)
  - Account Type (INVESTMENT, RETIREMENT, TRUST, etc.)
  - Client Profile (dropdown)
  - Master Account (if client account)
  - Custodian

  Test Data for Master Account:
  Account Category: "master"
  Account Number: "ACME-M001"
  Account Name: "Acme Master Investment Account"
  Account Type: "INVESTMENT"
  Client Profile: "Acme Investment Corp" (select from dropdown)
  Custodian: "Schwab"

  Test Data for Client Account:
  Account Category: "client"
  Account Number: "ACME-C001"
  Account Name: "Acme Trading Account"
  Account Type: "INVESTMENT"
  Client Profile: "Acme Investment Corp"
  Master Account: "ACME-M001" (from dropdown)
  Custodian: "Schwab"

  3. SECURITIES (/securities) - THIRD

  Fields:
  - Symbol (required)
  - Name (required)
  - Asset Class (EQUITY, BOND, MUTUAL_FUND, etc.)
  - Exchange
  - Currency
  - CUSIP
  - ISIN
  - Description

  Test Data:
  Symbol: "AAPL"
  Name: "Apple Inc"
  Asset Class: "EQUITY"
  Exchange: "NASDAQ"
  Currency: "USD"
  CUSIP: "037833100"
  Description: "Technology company"

  Symbol: "MSFT"
  Name: "Microsoft Corporation"
  Asset Class: "EQUITY"
  Exchange: "NASDAQ"
  Currency: "USD"
  CUSIP: "594918104"
  Description: "Software company"

  4. PRICES (/prices) - FOURTH

  Fields:
  - Date selector
  - Security grid with: Open, High, Low, Close*, Volume

  Test Data:
  Date: Today's date
  AAPL: Close: 175.50, Open: 174.20, High: 176.80, Low: 173.90, Volume: 50000000
  MSFT: Close: 335.20, Open: 334.50, High: 337.10, Low: 333.80, Volume: 25000000

  5. PRICE SERIES (/prices/series) - OPTIONAL

  Fields:
  - Security dropdown
  - Start Date / End Date
  - Price table for multiple dates

  Test Data:
  Security: "AAPL"
  Start Date: 30 days ago
  End Date: Today
  Fill in closing prices for recent dates (descending values to show trend)

  6. TRANSACTIONS (/transactions/entry) - FIFTH

  Fields (Grid Format):
  - Date, Type, Security, Quantity, Price, Amount, Account, Description, Status

  Test Data:
  Row 1: 2025-09-14, BUY, AAPL, 100, 175.50, 17550.00, ACME-M001, "Initial purchase", DRAFT
  Row 2: 2025-09-13, BUY, MSFT, 50, 335.20, 16760.00, ACME-M001, "Tech stock buy", DRAFT
  Row 3: 2025-09-12, DIVIDEND, AAPL, 100, 0.24, 24.00, ACME-M001, "Quarterly dividend", DRAFT

  RECOMMENDED ENTRY SEQUENCE:

  1. Clients → Create your client profiles first
  2. Accounts → Create master accounts, then client accounts
  3. Securities → Add securities you want to trade
  4. Prices → Enter current market prices
  5. Transactions → Record buy/sell transactions
  6. Price Series (optional) → Historical price data

  This sequence ensures all reference data exists before creating dependent records.
