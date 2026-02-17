# Testing Guide - Banking Dashboard

This guide walks you through testing all the implemented features.

## Prerequisites

1. Supabase tables must be set up with sample data:
   - Users with accounts
   - Pending transactions
   - Existing users with balances

2. Both dashboards should be accessible:
   - User Dashboard: `user-dashboard-design/user-dashboard.html`
   - Admin Dashboard: `admin-dashboard-design/admin-dashboard.html`

---

## Test 1: User Dashboard Transaction Fetching

### Objective
Verify that the user dashboard correctly fetches and displays only the logged-in user's transactions.

### Steps

1. **Open User Dashboard**
   - Navigate to `user-dashboard-design/user-dashboard.html`
   - You should see the login page

2. **Login with Test User**
   - Use any valid Supabase credentials
   - Expected: Dashboard loads with user's name and balance

3. **Navigate to Transactions**
   - Click the "Transactions" button in the sidebar
   - Expected: See a list of transactions specific to this user

4. **Verify Transaction Data**
   - Each transaction should show:
     - Recipient name
     - Amount
     - Type (Incoming/Outgoing)
     - Status (Pending/Successful/Rejected)
     - Date/Time
   - Expected: Only transactions for the logged-in user are shown

5. **Test Transaction Filtering**
   - Click "Incoming" filter button
   - Expected: Only incoming transactions are shown
   - Click "Outgoing" filter button
   - Expected: Only outgoing transactions are shown
   - Click "Pending" filter button
   - Expected: Only pending transactions are shown

6. **Test Cross-User Isolation**
   - Logout
   - Login as a different user
   - Navigate to Transactions
   - Expected: See completely different transactions (if user 2 has any)

---

## Test 2: Admin Dashboard Database Connection

### Objective
Verify that the admin dashboard is connected to Supabase and displays real database data.

### Steps

1. **Open Admin Dashboard**
   - Navigate to `admin-dashboard-design/admin-dashboard.html`
   - Expected: Dashboard loads immediately (no login required)
   - Check browser console for: "✅ Supabase client initialized in admin dashboard"
   - Check console for: "✅ Data loaded successfully"

2. **Verify Dashboard Stats**
   - Dashboard page shows:
     - Total users count
     - Total account balance
     - Pending transactions count
     - Total transactions count
   - Expected: Numbers match actual database data

3. **View Users Table**
   - Click "Student Management" nav item (or "Users")
   - Expected: See all users from `user` table
   - Each user shows:
     - Name
     - Email
     - Account Number
     - Balance
     - Status

4. **View Transactions Table**
   - Click "Transaction History" nav item
   - Expected: See all transactions from `transactions` table
   - Each transaction shows:
     - Transaction ID
     - Student name
     - Type (Credit/Debit)
     - Amount
     - Status
     - Date

5. **Verify Real-Time Data**
   - Check that the numbers are not placeholder values
   - Expected: Data matches what's actually in your Supabase database

---

## Test 3: Admin Transaction Approval

### Objective
Verify that admin can approve pending transactions and the database is updated.

### Steps

1. **Find Pending Transactions**
   - In admin dashboard, click "Transaction Approvals"
   - Expected: See "Pending Review" count
   - Expected: List of pending transactions

2. **Approve a Transaction**
   - Click "Review" button on any pending transaction
   - Modal opens showing transaction details
   - Click "Approve" button
   - Expected: 
     - Success message appears
     - Transaction moves from pending list
     - Status in database updates to "SUCCESSFUL"

3. **Verify in Database** (Optional - via Supabase Dashboard)
   - Open Supabase dashboard
   - Check `transactions` table
   - Find the approved transaction
   - Expected: `status` column = 'SUCCESSFUL'

4. **Rejection Test**
   - Go back to "Transaction Approvals"
   - Click "Review" on another pending transaction
   - Click "Reject" button
   - Expected:
     - Transaction status changes to "REJECTED"
     - If it was a debit, user gets refunded

---

## Test 4: Admin-Controlled Balance Adjustment

### Objective
Verify that admin can modify user balances and changes are saved to database.

### Steps

1. **Edit a User**
   - In Admin Dashboard, go to "Student Management"
   - Click the edit button (pencil icon) for any user
   - Modal opens with user details

2. **Quick Credit**
   - Enter an amount in "Adjust Amount" field (e.g., 100)
   - Click "Credit" button
   - Expected:
     - New balance = old balance + 100
     - Balance field updates immediately
     - Notification shows "Credited $100.00"

3. **Quick Debit**
   - Enter an amount in "Adjust Amount" field (e.g., 50)
   - Click "Debit" button
   - Expected:
     - New balance = old balance - 50
     - Balance field updates immediately
     - Notification shows "Debited $50.00"

4. **Verify in Database**
   - In Supabase, check the `accounts` table
   - Find the user's account
   - Expected: `balance` column shows the updated value

---

## Test 5: Real-Time Sync (Admin → User)

### Objective
Verify that user dashboard automatically reflects admin changes within 10 seconds.

### Steps

1. **Setup Two Browser Windows**
   - Window 1: User Dashboard - logged in as User A
   - Window 2: Admin Dashboard

2. **Check Initial Balance**
   - In Window 1, note User A's current balance
   - Example: $5000.00

3. **Admin Credits User**
   - In Window 2, edit User A
   - Add $1000 via Quick Credit
   - Close the modal
   - Expected: Balance in admin shows $6000.00

4. **Wait for Auto-Sync**
   - Watch Window 1 (User Dashboard)
   - Wait maximum 10 seconds
   - Expected: Balance changes from $5000.00 to $6000.00
   - Expected: No manual refresh needed

5. **Test with Debit**
   - In Window 2, edit User A
   - Debit $500
   - Watch Window 1
   - Expected: Balance updates to $5500.00 within 10 seconds

6. **Test Transaction Approval Sync**
   - In Window 1, note pending transactions
   - In Window 2, approve a pending transaction for User A
   - In Window 1, wait 10 seconds
   - Expected: Transaction status updates from "PENDING" to "SUCCESSFUL"

---

## Test 6: Create New User (Admin)

### Objective
Verify that admin can create new users in the database.

### Steps

1. **Open Admin Dashboard**
   - Go to "Student Management"
   - Click "Add Student" button

2. **Fill Form**
   - Name: "Test User 123"
   - Email: "testuser@example.com"
   - Account Number: "ACC-TEST-001"
   - Balance: "2500.00"
   - Click "Create"

3. **Verify in Database**
   - Expected: New user appears in users table
   - Expected: New account entry created with balance 2500.00
   - Expected: Notification shows success message

4. **Verify in Supabase**
   - Check `user` table - new entry exists
   - Check `accounts` table - new account linked to user

---

## Test 7: User Cannot Modify Their Own Balance

### Objective
Verify security - user balance is read-only on user dashboard.

### Steps

1. **Login to User Dashboard**
   - Navigate to profile page
   - Inspect the balance display element
   - Expected: It's a read-only `<input>` element or display-only text

2. **Verify No Balance Update Function**
   - Open browser console
   - Try to find any balance update function in user dashboard
   - Expected: No function exists (only admin has update functions)

3. **Confirm Database Control**
   - Check user dashboard code (view source)
   - Search for "accounts.update"
   - Expected: Result appears ONLY in admin dashboard, not user dashboard

---

## Test 8: Data Isolation (Multiple Users)

### Objective
Verify that users only see their own data.

### Steps

1. **Login as User A**
   - Note: User A has user_id = "abc123"
   - View their transactions

2. **Login as User B**
   - Note: User B has user_id = "xyz789"
   - View their transactions
   - Expected: Completely different transaction list

3. **Logout and Relogin as User A**
   - Expected: See the same transactions as before (User A's transactions)

4. **Verify in Database**
   - Check transactions are linked by account_id, not user_id
   - Expected: account_id filter correctly isolates data

---

## Troubleshooting

### "Failed to load data from Supabase"
- Check Supabase SDK is loaded (check browser console)
- Verify config.js has correct credentials
- Check network tab in browser dev tools for CORS errors

### Admin Dashboard Shows No Users
- Check if tables exist in Supabase
- Verify Supabase connection in initializeSupabase()
- Check console for specific error message

### User Dashboard Shows No Transactions
- Verify account_id is being used (not user_id)
- Check that transactions table has correct account_id values
- Verify user is logged in (appState.isLoggedIn = true)

### Balance Not Updating in Real-Time
- Check auto-refresh is running (should see network requests every 10 seconds)
- Verify balance change was saved to database
- Try manual page refresh (should show updated balance)

---

## Success Criteria

✅ All tests should pass for the implementation to be complete.

### Summary Test Checklist

| Feature | Status | Notes |
|---------|--------|-------|
| User login works | ⬜ | |
| Transaction filtering works | ⬜ | |
| User data isolation works | ⬜ | |
| Admin dashboard loads | ⬜ | |
| Admin sees all users | ⬜ | |
| Admin sees all transactions | ⬜ | |
| Admin can approve transactions | ⬜ | |
| Admin can reject transactions | ⬜ | |
| Admin can credit balance | ⬜ | |
| Admin can debit balance | ⬜ | |
| Balance changes sync to user (10s) | ⬜ | |
| User cannot modify own balance | ⬜ | |
| No errors in console | ⬜ | |

---

## Performance Testing

### Expected Performance Metrics

- **Page Load Time**: < 2 seconds
- **Data Fetch Time**: < 1 second
- **Auto-Refresh Interval**: 10 seconds (configurable in code)
- **UI Update Time**: < 100ms (after data fetch)

### Performance Test

1. Open browser DevTools (F12)
2. Go to Network tab
3. Load admin dashboard
4. Expected: All network requests complete within 2 seconds

---

## Conclusion

Once all tests pass, the implementation is complete and ready for production.

For any issues, check:
1. Browser console for error messages
2. Network tab for failed requests
3. Supabase dashboard for data consistency
