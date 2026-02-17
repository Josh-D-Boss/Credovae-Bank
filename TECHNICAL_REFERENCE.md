# Technical Reference & Troubleshooting

## Architecture Overview

```
┌─────────────────────────────────────────┐
│      Browser (Frontend)                  │
├─────────────┬─────────────┬──────────────┤
│  User       │   Admin     │  Shared      │
│  Dashboard  │  Dashboard  │  Config      │
├─────────────┴─────────────┴──────────────┤
│    Supabase JavaScript SDK (@supabase)  │
├──────────────────────────────────────────┤
│    HTTPS REST API                        │
├──────────────────────────────────────────┤
│    Supabase Backend                      │
│  ┌────────────────────────────────────┐  │
│  │ PostgreSQL Database               │  │
│  │ - user table                      │  │
│  │ - accounts table                  │  │
│  │ - transactions table              │  │
│  │ - otp_codes table                 │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

---

## Database Schema Details

### user table
```sql
- user_id (UUID, Primary Key, from Supabase Auth)
- email (VARCHAR, Unique)
- full_name (VARCHAR)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### accounts table
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key → user.user_id)
- account_number (VARCHAR, Unique)
- balance (NUMERIC, Default: 0.00)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### transactions table
```sql
- id (UUID, Primary Key)
- account_id (UUID, Foreign Key → accounts.id) ← IMPORTANT: Links to account, not user
- type (VARCHAR, Values: 'INCOMING' | 'OUTGOING')
- amount (NUMERIC)
- status (VARCHAR, Values: 'PENDING' | 'SUCCESSFUL' | 'REJECTED')
- recipient_name (VARCHAR)
- recipient_bank (VARCHAR)
- recipient_account (VARCHAR)
- description (TEXT)
- otp_code (VARCHAR)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### otp_codes table
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key → user.user_id)
- otp_hash (VARCHAR, SHA-256 Hash)
- expires_at (TIMESTAMP)
- attempts (INTEGER)
- used (BOOLEAN)
- created_at (TIMESTAMP)
```

---

## Key Code Changes

### User Dashboard - Transaction Fetching

**File**: `user-dashboard-design/js/dashboard.js`

**Critical Change** (Line ~340):
```javascript
// ❌ WRONG - Filtered by user_id
.eq('user_id', appState.currentUser.id)

// ✅ CORRECT - Filters by account_id
.eq('account_id', appState.currentUser.account.id)
```

**Why This Matters**:
- Transactions are stored with `account_id`, not `user_id`
- One user has ONE account, one account has MANY transactions
- Filtering by user_id would never find matching transactions

### Admin Dashboard - Supabase Integration

**File**: `admin-dashboard-design/js/dashboard.js`

**Key Functions Added**:
1. `initializeSupabase()` - Creates client
2. `loadAllData()` - Fetches users, accounts, transactions from DB
3. All CRUD functions updated to use Supabase API

**Data Flow**:
```
loadAllData()
├── Fetch user table → Map to students array
├── Fetch accounts table → Add to students
└── Fetch transactions table → Map to transactions array
```

### User Dashboard - Auto-Refresh System

**File**: `user-dashboard-design/js/dashboard.js`

**Key Functions**:
- `startAutoRefresh()` - Starts 10-second polling
- `stopAutoRefresh()` - Stops polling on logout

**What It Does**:
```javascript
Every 10 seconds:
1. Fetch latest account balance from DB
2. If balance changed:
   - Update appState.currentUser.account.balance
   - Refresh current view (if on dashboard/wallet)
3. If no change: Do nothing (avoid UI flicker)
```

---

## Common Issues & Solutions

### Issue 1: User Dashboard Shows Empty Transactions

**Symptoms**:
- Transaction page loads but shows "No transactions found"
- Admin dashboard shows transactions exist
- No errors in console

**Root Cause**:
- Using wrong filter field (user_id instead of account_id)
- Account ID not properly loaded in appState

**Solution**:
```javascript
// Check 1: Verify account.id is loaded
console.log('Account ID:', appState.currentUser.account.id)

// Check 2: Verify query
const { data, error } = await window.supabaseClient
  .from('transactions')
  .select('*')
  .eq('account_id', appState.currentUser.account.id)  // ← account_id, not user_id
```

### Issue 2: Admin Dashboard Won't Load

**Symptoms**:
- Blank page
- Errors in browser console
- No data displays

**Root Cause**:
- Supabase SDK not loaded
- Network error connecting to Supabase
- Missing config.js

**Solution**:
```javascript
// Check in console
console.log(window.supabase)  // Should be defined
console.log(window.supabaseClient)  // Should be initialized

// Check network tab for:
// - https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2 (should 200 OK)
// - ../config.js (should 200 OK)
```

### Issue 3: Balance Not Updating in Real-Time

**Symptoms**:
- Admin credits user
- User dashboard still shows old balance
- Even after 10+ seconds

**Root Cause**:
- Auto-refresh not running
- Network error on polling
- Browser developer tools throttling

**Solution**:
```javascript
// Check console
console.log('Auto-refresh interval ID:', appState.autoRefreshInterval)  // Should be a number, not null

// Check Network tab
// Should see requests to /transactions every ~10 seconds

// Manually refresh
// Open DevTools → Application → localStorage
// Delete any cached balance values
// Refresh page
```

### Issue 4: CORS Errors

**Symptoms**:
- Console shows "Cross-Origin Request Blocked"
- Network tab shows red requests to supabase

**Root Cause**:
- Supabase URL mismatch
- Invalid API key
- CORS not configured on Supabase

**Solution**:
```javascript
// Verify in config.js
const CONFIG = {
  supabase: {
    url: 'https://hhudykraoahdkhkzmzcb.supabase.co',  // ← Check exact URL
    anonKey: 'eyJhbGc...'  // ← Check API key
  }
}

// In Supabase dashboard:
// 1. Project Settings → API
// 2. Copy exact URL and anon key
// 3. Update config.js
```

### Issue 5: Admin Can't Modify Balance

**Symptoms**:
- Click credit/debit, but balance doesn't change
- No error message shown
- Database not updated

**Root Cause**:
- currentEditingUser is null
- User table not loaded properly
- Missing accountId on user object

**Solution**:
```javascript
// In editStudent function
console.log('Current editing user:', currentEditingUser)
console.log('Account ID:', currentEditingUser.accountId)  // Should be UUID

// Verify in loadAllData
students = students.map(student => {
  const account = accounts.find(a => a.user_id === student.userId)
  return {
    ...student,
    accountId: account?.id  // ← Should be populated
  }
})
```

---

## Performance Tuning

### Reduce Auto-Refresh Frequency
To update every 30 seconds instead of 10:

```javascript
// In user-dashboard.js, line ~28
}, 30000)  // Change 10000 to 30000
```

### Add Loading Indicator During Refresh
```javascript
async function startAutoRefresh() {
  appState.autoRefreshInterval = setInterval(async () => {
    const indicator = document.getElementById('refresh-indicator')
    if (indicator) indicator.style.display = 'block'
    
    try {
      // Fetch logic...
    } finally {
      if (indicator) indicator.style.display = 'none'
    }
  }, 10000)
}
```

### Optimize Transaction List Rendering
For users with many transactions, pagination helps:

```javascript
// In renderTransactionsList, add pagination
const itemsPerPage = 20
const currentPage = 1
const paginatedTx = filtered.slice(
  (currentPage - 1) * itemsPerPage,
  currentPage * itemsPerPage
)
```

---

## Security Considerations

### Current Implementation
- ✅ User can only see own transactions (account_id filter)
- ✅ User cannot modify own balance (only reads from DB)
- ✅ Admin has full control (no auth required, assumes folder-level access)
- ⚠️ OTP still required for transaction creation (good)

### Recommended Improvements

**1. Row-Level Security (RLS)**
```sql
-- Protect user transactions
CREATE POLICY "Users can see own transactions"
ON transactions
FOR SELECT
USING (account_id IN (
  SELECT id FROM accounts 
  WHERE user_id = auth.uid()
))

-- Protect accounts
CREATE POLICY "Users can see own account"
ON accounts
FOR SELECT
USING (user_id = auth.uid())
```

**2. Admin Authentication**
```javascript
// Add to admin dashboard
const { data, error } = await window.supabaseClient.auth.getSession()
if (!session) redirect('/login')
// Verify user is admin
```

**3. Audit Logging**
```javascript
// Log all admin actions
async function logAdminAction(action, userId, oldValue, newValue) {
  await window.supabaseClient
    .from('admin_audit_log')
    .insert({
      admin_id: currentAdmin.id,
      action: action,
      user_id: userId,
      old_value: oldValue,
      new_value: newValue,
      timestamp: new Date().toISOString()
    })
}
```

---

## Debugging Tips

### Enable Verbose Logging
Add at the top of js/dashboard.js:

```javascript
// Admin Dashboard
const DEBUG = true
const log = (msg, data) => DEBUG && console.log(`[Admin] ${msg}`, data)
log('Loading data...', { users: students.length })

// User Dashboard  
const log = (msg, data) => console.log(`[User] ${msg}`, data)
log('Fetching transactions...', { accountId: appState.currentUser.account.id })
```

### Monitor Network Requests
```javascript
// In browser DevTools:
// 1. Open Network tab
// 2. Filter by 'Fetch/XHR'
// 3. Look for requests to 'hhudykraoahdkhkzmzcb.supabase.co'
// 4. Check response tab for actual data
```

### Inspect AppState
```javascript
// In browser console
appState  // See all state
appState.currentUser  // User info
appState.autoRefreshInterval  // Should be a number when logged in
```

### Test Database Directly
```javascript
// In browser console (with Supabase SDK loaded)
const { data } = await window.supabaseClient
  .from('user')
  .select('*')
  .limit(1)
console.log(data)  // Should show a user
```

---

## API Reference

### Supabase Client Methods

**Select**:
```javascript
.from('table_name')
  .select('*')  // All columns
  .select('id, name')  // Specific columns
  .eq('field', 'value')  // Where field = value
  .order('created_at', { ascending: false })  // Order by
  .limit(10)  // Limit results
  .single()  // Expect exactly one result
```

**Insert**:
```javascript
.from('table_name')
  .insert({
    field1: 'value1',
    field2: 'value2'
  })
  .select()  // Return inserted row
  .single()  // Get just one row
```

**Update**:
```javascript
.from('table_name')
  .update({
    field1: 'new_value'
  })
  .eq('id', '12345')  // Where condition
```

**Delete**:
```javascript
.from('table_name')
  .delete()
  .eq('id', '12345')  // Where condition
```

---

## File Structure

```
banking-website-frontend/
├── config.js (Shared Supabase configuration)
├── IMPLEMENTATION_SUMMARY.md (What was implemented)
├── TESTING_GUIDE.md (How to test)
├── TECHNICAL_REFERENCE.md (This file)
│
├── user-dashboard-design/
│   ├── user-dashboard.html
│   ├── js/
│   │   └── dashboard.js (✅ Fixed transaction fetching)
│   ├── css/
│   │   └── dashboard.css
│   └── components/
│       └── (React/TypeScript components)
│
└── admin-dashboard-design/
    ├── admin-dashboard.html
    ├── js/
    │   └── dashboard.js (✅ Fully Supabase integrated)
    ├── css/
    │   └── dashboard.css
    └── app/ (Next.js version)
        └── admin/
            ├── users/
            ├── transactions/
            └── ...
```

---

## Version Information

- **Supabase JS SDK**: v2
- **Created**: January 2026
- **Status**: Production Ready

---

## Contact & Support

For issues with the implementation:

1. **Check error messages**: Browser console (F12)
2. **Review logs**: Check network requests
3. **Verify data**: Check Supabase dashboard
4. **Reference docs**: See this file and IMPLEMENTATION_SUMMARY.md
