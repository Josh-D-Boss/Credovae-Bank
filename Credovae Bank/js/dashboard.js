// ============================================================================
// USER BANKING DASHBOARD - SUPABASE AUTH + RESEND OTP IMPLEMENTATION
// Complete real-time banking system with email OTP verification
// ============================================================================

// Application State
const appState = {
  currentUser: null,
  isLoggedIn: false,
  isDarkMode: localStorage.getItem('theme') === 'dark',
  currentTransfer: null,
  pendingOTP: null,
  autoRefreshInterval: null
}

// ============================================================================
// AUTO-REFRESH SYSTEM (Syncs with admin changes)
// ============================================================================

async function startAutoRefresh() {
  // Refresh account balance and transactions every 10 seconds
  appState.autoRefreshInterval = setInterval(async () => {
    if (!appState.isLoggedIn || !appState.currentUser) return

    try {
      // Refresh account balance
      const { data: account } = await window.supabaseClient
        .from('accounts')
        .select('*')
        .eq('id', appState.currentUser.account.id)
        .single()

      if (account) {
        // Only update display if balance changed (to avoid flickering)
        if (account.balance !== appState.currentUser.account.balance) {
          console.log('📊 Balance updated:', account.balance)
          appState.currentUser.account.balance = account.balance

          // Refresh the current view if on dashboard
          const activeSection = document.querySelector('.nav-item.active')?.dataset.section
          if (activeSection === 'dashboard') {
            await renderDashboardOverview()
          } else if (activeSection === 'wallet') {
            renderWalletPage()
          } else if (activeSection === 'messages') {
            await renderMessagesPage()
          }
        }
      }
    } catch (error) {
      console.error('Auto-refresh failed:', error)
    }
  }, 10000) // 10 second refresh interval
}

function stopAutoRefresh() {
  if (appState.autoRefreshInterval) {
    clearInterval(appState.autoRefreshInterval)
    appState.autoRefreshInterval = null
  }
}

// ============================================================================
// AUTHENTICATION SYSTEM (SUPABASE AUTH)
// ============================================================================

class AuthManager {
  static async login(email, password) {
    try {
      console.log('🔐 Attempting login for:', email)

      // ✅ Use Supabase Auth instead of direct table query
      const { data: authData, error: authError } = await window.supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
      })

      if (authError || !authData.user) {
        console.error('Login failed:', authError)
        return { success: false, error: authError?.message || 'Invalid email or password' }
      }

      console.log('✅ Auth successful:', authData.user.email)

      // ✅ Now get the user's profile and account from your custom tables
      const { data: profile, error: profileError } = await window.supabaseClient
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single()

      if (profileError) {
        console.error('Profile fetch error:', profileError)
        // If profile doesn't exist, create one
        const { data: newProfile, error: createError } = await window.supabaseClient
          .from('users')
          .insert({
            id: authData.user.id,
            email: authData.user.email,
            name: authData.user.user_metadata?.full_name || authData.user.email.split('@')[0]
          })
          .select()
          .single()

        if (createError) {
          console.error('Failed to create profile:', createError)
          return { success: false, error: 'Failed to create user profile' }
        }
      }

      // ✅ Get user's account
      const { data: account, error: accountError } = await window.supabaseClient
        .from('accounts')
        .select('*')
        .eq('user_id', authData.user.id)
        .single()

      if (accountError) {
        console.error('Account fetch error:', accountError)
        // Create account if it doesn't exist
        const accountNumber = 'ACC' + Math.random().toString().slice(2, 12)
        const { data: newAccount, error: createAccError } = await window.supabaseClient
          .from('accounts')
          .insert({
            user_id: authData.user.id,
            account_number: accountNumber,
            balance: 5000.00 // Default starting balance
          })
          .select()
          .single()

        if (createAccError) {
          console.error('Failed to create account:', createAccError)
          return { success: false, error: 'Failed to create account' }
        }

        appState.currentUser = {
          id: authData.user.id,
          email: authData.user.email,
          name: profile?.full_name || authData.user.email.split('@')[0],
          account: newAccount
        }
      } else {
        appState.currentUser = {
          id: authData.user.id,
          email: authData.user.email,
          name: profile?.name || authData.user.email.split('@')[0],
          account: account
        }
      }

      appState.isLoggedIn = true

      console.log('✅ Login complete!', appState.currentUser)
      startAutoRefresh()
      return { success: true, user: authData.user }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, error: error.message }
    }
  }

  static async logout() {
    stopAutoRefresh()
    await window.supabaseClient.auth.signOut()
    appState.isLoggedIn = false
    appState.currentUser = null
    renderLoginPage()
  }

  static async checkSession() {
    try {
      console.log('🔍 Checking for existing session...')

      // ✅ Check Supabase Auth session
      const { data: { session }, error } = await window.supabaseClient.auth.getSession()

      if (error || !session) {
        console.log('ℹ️ No session found')
        return false
      }

      console.log('✅ Session found:', session.user.email)

      // ✅ Restore user profile
      const { data: profile } = await window.supabaseClient
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()

      // Get account
      const { data: account } = await window.supabaseClient
        .from('accounts')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (!account) {
        console.error('No account found for user')
        return false
      }

      appState.currentUser = {
        id: session.user.id,
        email: session.user.email,
        name: profile?.name || session.user.email.split('@')[0],
        account: account
      }
      appState.isLoggedIn = true

      console.log('✅ Session restored for:', appState.currentUser.name)
      startAutoRefresh()
      return true
    } catch (error) {
      console.error('Session restore failed:', error)
      return false
    }
  }
}

// ============================================================================
// OTP MANAGER - RESEND EMAIL + SUPABASE STORAGE
// ============================================================================

class OTPManager {
  static generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  static async hashOTP(otp) {
    const encoder = new TextEncoder()
    const data = encoder.encode(otp)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  static async sendOTP(userEmail, userName, recipientName, amount) {
    try {
      const otp = this.generateOTP()
      const hashedOTP = await this.hashOTP(otp)
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

      const { data: otpRecord, error: dbError } = await window.supabaseClient
        .from('otp_codes')
        .insert({
          user_id: appState.currentUser.id,
          otp_hash: hashedOTP,
          expires_at: expiresAt,
          attempts: 0
        })
        .select()
        .single()

      if (dbError) throw dbError

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.resend.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: CONFIG.resend.fromEmail,
          to: userEmail,
          subject: 'BankDash - Your Transaction OTP',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">Transaction Verification</h2>
              <p>Hello ${userName},</p>
              <p>You are initiating a transfer of <strong>$${amount.toFixed(2)}</strong> to <strong>${recipientName}</strong>.</p>
              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #6b7280;">Your OTP Code:</p>
                <h1 style="margin: 10px 0; font-size: 36px; letter-spacing: 8px; color: #2563eb;">${otp}</h1>
                <p style="margin: 0; font-size: 12px; color: #6b7280;">Valid for 5 minutes</p>
              </div>
              <p style="color: #ef4444; font-size: 14px;">⚠️ Never share this code with anyone</p>
            </div>
          `
        })
      })

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text()
        console.error('Email send failed:', errorText)
        throw new Error('Failed to send email')
      }

      console.log('✅ OTP sent successfully')
      console.log('🔐 OTP (for testing):', otp)

      return { success: true, otpId: otpRecord.id, plainOTP: otp }
    } catch (error) {
      console.error('OTP send failed:', error)
      return { success: false, error: error.message }
    }
  }

  static async verifyOTP(otpId, enteredOTP) {
    try {
      const { data: otpRecord, error } = await window.supabaseClient
        .from('otp_codes')
        .select('*')
        .eq('id', otpId)
        .single()

      if (error || !otpRecord) {
        return { success: false, error: 'Invalid OTP' }
      }

      if (new Date(otpRecord.expires_at) < new Date()) {
        return { success: false, error: 'OTP expired' }
      }

      if (otpRecord.attempts >= 3) {
        return { success: false, error: 'Too many attempts' }
      }

      const enteredHash = await this.hashOTP(enteredOTP)

      if (enteredHash !== otpRecord.otp_hash) {
        await window.supabaseClient
          .from('otp_codes')
          .update({ attempts: otpRecord.attempts + 1 })
          .eq('id', otpId)

        return { success: false, error: 'Invalid OTP' }
      }

      await window.supabaseClient
        .from('otp_codes')
        .update({ used: true })
        .eq('id', otpId)

      return { success: true }
    } catch (error) {
      console.error('OTP verification failed:', error)
      return { success: false, error: error.message }
    }
  }
}

// ============================================================================
// TRANSACTION MANAGER - SUPABASE DATABASE
// ============================================================================

class TransactionManager {
  static async createTransaction(type, amount, recipientName, bankName, accountNumber, description) {
    try {
      if (type === 'OUTGOING') {
        const newBalance = appState.currentUser.account.balance - amount

        await window.supabaseClient
          .from('accounts')
          .update({ balance: newBalance })
          .eq('id', appState.currentUser.account.id)

        appState.currentUser.account.balance = newBalance
      }

      // ✅ ONLY save these fields to transactions table
      const { data: transaction, error } = await window.supabaseClient
        .from('transactions')
        .insert({
          account_id: appState.currentUser.account.id,  // ✅ Link to account
          type: type,                                    // ✅ INCOMING or OUTGOING
          amount: amount,                                // ✅ Transfer amount
          recipient_name: recipientName,                 // ✅ Who receives
          recipient_bank: bankName,                      // ✅ Bank name
          recipient_account: accountNumber,              // ✅ Recipient's account number
          description: description,                      // ✅ Optional note
          status: 'PENDING'                              // ✅ Initial status
        })
        .select()
        .single()

      if (error) throw error

      console.log('✅ Transaction created:', transaction)
      return { success: true, transaction }
    } catch (error) {
      console.error('Transaction creation failed:', error)
      return { success: false, error: error.message }
    }
  }

  static async getTransactions() {
    try {
      // ✅ Filter by account_id (not user_id) since transactions are linked to accounts
      const { data, error } = await window.supabaseClient
        .from('transactions')
        .select('*')
        .eq('account_id', appState.currentUser.account.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Failed to load transactions:', error)
      return []
    }
  }

  static async getStats() {
    const transactions = await this.getTransactions()

    const incoming = transactions
      .filter(t => t.type === 'INCOMING' && (t.status === 'SUCCESSFUL' || t.status === 'approved'))
      .reduce((sum, t) => sum + parseFloat(t.amount), 0)

    const outgoing = transactions
      .filter(t => t.type === 'OUTGOING' && (t.status === 'SUCCESSFUL' || t.status === 'approved'))
      .reduce((sum, t) => sum + parseFloat(t.amount), 0)

    const pending = transactions.filter(t => t.status === 'PENDING').length

    return {
      incomingTotal: incoming,
      outgoingTotal: outgoing,
      transactionCount: transactions.length,
      pendingCount: pending
    }
  }
}

// ============================================================================
// UI RENDERING FUNCTIONS
// ============================================================================

function renderLoginPage() {
  document.getElementById('login-page').classList.remove('hidden')
  document.getElementById('dashboard-page').classList.add('hidden')
}

function renderDashboardPage() {
  document.getElementById('login-page').classList.add('hidden')
  document.getElementById('dashboard-page').classList.remove('hidden')

  const welcomeEl = document.getElementById('user-welcome')
  if (welcomeEl) {
    welcomeEl.textContent = `Welcome, ${appState.currentUser.name}`
  }

  const pageTitle = document.getElementById('page-title')
  if (pageTitle) {
    pageTitle.textContent = 'Dashboard'
  }

  renderDashboardContent()

  updateNotificationBadge()
}

async function renderDashboardContent() {
  const activeSection = document.querySelector('.nav-item.active')?.dataset.section || 'dashboard'

  const pageTitle = document.getElementById('page-title')
  if (pageTitle) {
    pageTitle.textContent = activeSection.charAt(0).toUpperCase() + activeSection.slice(1)
  }

  switch (activeSection) {
    case 'dashboard':
      await renderDashboardOverview()
      break
    case 'wallet':
      renderWalletPage()
      break
    case 'transactions':
      await renderTransactionsPage()
      break
    case 'messages':
      await renderMessagesPage()
      break
    case 'profile':
      renderProfilePage()
      break
  }
}

async function renderDashboardOverview() {
  const container = document.getElementById('content-container')
  const stats = await TransactionManager.getStats()
  const transactions = await TransactionManager.getTransactions()
  const recent = transactions.slice(0, 5)

  // ✅ FIX: Calculate available balance = account balance + incoming transactions
  const availableBalance = appState.currentUser.account.balance + stats.incomingTotal

  const html = `
    <div class="space-y-6">
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Account Balance</h2>
        </div>
        <div class="card-content">
          <div class="space-y-4">
            <div>
              <p class="text-sm text-muted-foreground">Available Balance</p>
              <p class="text-4xl font-bold text-primary">$${appState.currentUser.account.balance.toFixed(2)}</p>
            </div>
            <div class="grid grid-cols-2 gap-4 pt-4">
              <button class="btn btn-primary" id="send-money-btn">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                Send Money
              </button>
              <button class="btn btn-outline" disabled style="opacity: 0.5; cursor: not-allowed;">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                Add Funds
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="card">
          <div class="card-header"><h3 class="card-title text-sm">Incoming</h3></div>
          <div class="card-content">
            <p class="text-2xl font-bold text-green-600">$${stats.incomingTotal.toFixed(2)}</p>
            <p class="text-xs text-muted-foreground mt-2">Total received</p>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3 class="card-title text-sm">Outgoing</h3></div>
          <div class="card-content">
            <p class="text-2xl font-bold text-red-600">$${stats.outgoingTotal.toFixed(2)}</p>
            <p class="text-xs text-muted-foreground mt-2">Total sent</p>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3 class="card-title text-sm">Pending</h3></div>
          <div class="card-content">
            <p class="text-2xl font-bold text-orange-600">${stats.pendingCount}</p>
            <p class="text-xs text-muted-foreground mt-2">Transactions</p>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h2 class="card-title">Recent Activity</h2></div>
        <div class="card-content">
          ${recent.length > 0 ? `
            <div class="space-y-3">
              ${recent.map(txn => `
                <div class="flex items-center justify-between p-3 rounded-lg bg-muted/50 transition-all hover:bg-muted">
                  <div class="flex items-center gap-3 flex-1">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center ${txn.type === 'INCOMING' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}">
                      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${txn.type === 'INCOMING'
      ? '<polyline points="23 6 13.5 15.5 8.5 10.5 1 17"/><polyline points="17 6 23 6 23 12"/>'
      : '<polyline points="1 18 11.5 8.5 16.5 13.5 23 6"/><polyline points="7 18 1 18 1 12"/>'}
                      </svg>
                    </div>
                    <div class="flex-1">
                      <p class="font-medium">${txn.recipient_name}</p>
                      <p class="text-xs text-muted-foreground">${new Date(txn.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="font-semibold ${txn.type === 'INCOMING' ? 'text-green-600' : 'text-red-600'}">
                      ${txn.type === 'INCOMING' ? '+' : '-'}$${parseFloat(txn.amount).toFixed(2)}
                    </p>
                    <span class="text-xs px-2 py-1 rounded ${txn.status === 'PENDING' ? 'bg-orange-100 text-orange-700' :
      (txn.status === 'SUCCESSFUL' || txn.status === 'approved') ? 'bg-green-100 text-green-700' :
        'bg-red-100 text-red-700'
    }">${txn.status}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <p class="text-center text-muted-foreground py-8">No transactions yet</p>
          `}
        </div>
      </div>
    </div>
  `

  container.innerHTML = html
  document.getElementById('send-money-btn')?.addEventListener('click', openTransferFlow)
}

function renderWalletPage() {
  const container = document.getElementById('content-container')
  container.innerHTML = `
    <div class="space-y-6">
      <div class="card">
        <div class="card-header"><h2 class="card-title">Primary Account</h2></div>
        <div class="card-content space-y-6">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-muted-foreground">Account Number</p>
              <p class="font-mono font-semibold mt-2">${appState.currentUser.account.account_number}</p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Available Balance</p>
              <p class="text-2xl font-bold text-primary mt-2">$${appState.currentUser.account.balance.toFixed(2)}</p>
            </div>
          </div>
          <button class="btn btn-primary" id="send-money-wallet">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            Send Money
          </button>
        </div>
      </div>
    </div>
  `
  document.getElementById('send-money-wallet')?.addEventListener('click', openTransferFlow)
}

async function renderTransactionsPage() {
  const container = document.getElementById('content-container')
  const transactions = await TransactionManager.getTransactions()

  container.innerHTML = `
    <div class="space-y-6">
      <div class="space-y-2 mb-4">
        <div class="flex gap-2 flex-wrap">
          <button class="filter-btn active" data-filter="all">All</button>
          <button class="filter-btn" data-filter="INCOMING">Incoming</button>
          <button class="filter-btn" data-filter="OUTGOING">Outgoing</button>
          <button class="filter-btn" data-filter="PENDING">Pending</button>
        </div>
      </div>

      <div class="card">
        <div class="card-content" id="transactions-list-container">
          ${renderTransactionsList(transactions, 'all')}
        </div>
      </div>
    </div>
  `

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      const filter = btn.dataset.filter
      document.getElementById('transactions-list-container').innerHTML = renderTransactionsList(transactions, filter)
    })
  })
}

function renderTransactionsList(transactions, filter) {
  let filtered = transactions

  if (filter === 'INCOMING') {
    filtered = transactions.filter(t => t.type === 'INCOMING')
  } else if (filter === 'OUTGOING') {
    filtered = transactions.filter(t => t.type === 'OUTGOING')
  } else if (filter === 'PENDING') {
    filtered = transactions.filter(t => t.status === 'PENDING')
  }

  if (filtered.length === 0) {
    return '<p class="text-center text-muted-foreground py-8">No transactions found</p>'
  }

  return `
    <div class="space-y-3">
      ${filtered.map(txn => `
        <div class="flex items-center justify-between p-4 rounded-lg border">
          <div class="flex items-center gap-4 flex-1">
            <div class="w-12 h-12 rounded-full flex items-center justify-center ${txn.type === 'INCOMING' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${txn.type === 'INCOMING'
      ? '<polyline points="23 6 13.5 15.5 8.5 10.5 1 17"/>'
      : '<polyline points="1 18 11.5 8.5 16.5 13.5 23 6"/>'}
              </svg>
            </div>
            <div class="flex-1">
              <p class="font-medium">${txn.recipient_name}</p>
              <p class="text-sm text-muted-foreground">${txn.recipient_bank || 'N/A'}</p>
              <p class="text-xs text-muted-foreground">${new Date(txn.created_at).toLocaleString()}</p>
            </div>
          </div>
          <div class="text-right">
            <p class="font-semibold ${txn.type === 'INCOMING' ? 'text-green-600' : 'text-red-600'}">
              ${txn.type === 'INCOMING' ? '+' : '-'}$${parseFloat(txn.amount).toFixed(2)}
            </p>
            <span class="text-xs px-2 py-1 rounded ${txn.status === 'PENDING' ? 'bg-orange-100 text-orange-700' :
      (txn.status === 'SUCCESSFUL' || txn.status === 'approved') ? 'bg-green-100 text-green-700' :
        'bg-red-100 text-red-700'
    }">${txn.status}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `
}

async function renderMessagesPage() {
  const container = document.getElementById('content-container')

  try {
    // ✅ Fetch messages AND mark them as read
    const { data: messages, error } = await window.supabaseClient
      .from('messages')
      .select('*')
      .eq('user_id', appState.currentUser.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    // ✅ Mark all messages as read when page is opened
    const unreadIds = messages
      .filter(msg => msg.is_read === false)
      .map(msg => msg.id)

    if (unreadIds.length > 0) {
      await window.supabaseClient
        .from('messages')
        .update({ is_read: true })
        .in('id', unreadIds)
      
      console.log('✅ Marked', unreadIds.length, 'messages as read')
      
      // Update badge
      updateNotificationBadge()
    }

    let messagesHTML = '<div class="space-y-4">'

    if (!messages || messages.length === 0) {
      messagesHTML += '<div class="card"><div class="card-content"><p class="text-muted-foreground">No messages yet</p></div></div>'
    } else {
      messages.forEach(msg => {
        const date = new Date(msg.created_at).toLocaleDateString() + ' ' + new Date(msg.created_at).toLocaleTimeString()
        messagesHTML += `
          <div class="card">
            <div class="card-content">
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <h3 class="font-semibold text-lg mb-2">Message from Admin</h3>
                  <p class="text-muted-foreground mb-3">${msg.message_text}</p>
                  <p class="text-sm text-muted-foreground">${date}</p>
                </div>
              </div>
            </div>
          </div>
        `
      })
    }

    messagesHTML += '</div>'
    container.innerHTML = messagesHTML
  } catch (error) {
    container.innerHTML = `<div class="card"><div class="card-content"><p class="text-red-600">Error loading messages: ${error.message}</p></div></div>`
  }
}

async function updateNotificationBadge() {
  try {
    // Count unread messages
    const { data: unreadMessages, error } = await window.supabaseClient
      .from('messages')
      .select('id')
      .eq('user_id', appState.currentUser.id)
      .eq('is_read', false)

    if (error) throw error

    const unreadCount = unreadMessages?.length || 0
    const badge = document.getElementById('userNotificationBadge')

    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount
        badge.style.display = 'flex'
        console.log('📬 Unread messages:', unreadCount)
      } else {
        badge.style.display = 'none'
      }
    }
  } catch (error) {
    console.error('Failed to update notification badge:', error)
  }
}

function renderProfilePage() {
  const container = document.getElementById('content-container')
  container.innerHTML = `
    <div class="space-y-6">
      <div class="card">
        <div class="card-header"><h2 class="card-title">Personal Information</h2></div>
        <div class="card-content space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-2">
              <label class="label">Full Name</label>
              <input type="text" class="input" value="${appState.currentUser.name}" readonly/>
            </div>
            <div class="space-y-2">
              <label class="label">Email</label>
              <input type="email" class="input" value="${appState.currentUser.email}" readonly/>
            </div>
            <div class="space-y-2">
              <label class="label">Account Number</label>
              <input type="text" class="input" value="${appState.currentUser.account.account_number}" readonly/>
            </div>
            <div class="space-y-2">
              <label class="label">Account Balance</label>
              <input type="text" class="input" value="$${appState.currentUser.account.balance.toFixed(2)}" readonly/>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}

// ============================================================================
// TRANSFER FLOW WITH OTP
// ============================================================================

function openTransferFlow() {
  appState.currentTransfer = {
    method: null,
    recipientName: '',
    bankName: '',
    recipientAccount: '',
    amount: 0,
    description: ''
  }
  showModal('transfer-method-modal')
}

function showModal(modalId) {
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'))
  document.getElementById(modalId).classList.remove('hidden')
}

function hideModal(modalId) {
  document.getElementById(modalId).classList.add('hidden')
}

function showTransferDetailsModal() {
  document.getElementById('sender-account-number').textContent = appState.currentUser.account.account_number
  document.getElementById('sender-balance').textContent = `$${appState.currentUser.account.balance.toFixed(2)}`
  showModal('recipient-details-modal')
}

async function sendOTPAndShowModal() {
  const recipientName = document.getElementById('recipient-name').value
  const bankName = document.getElementById('recipient-bank').value
  const recipientAccount = document.getElementById('recipient-account').value
  const amount = parseFloat(document.getElementById('transfer-amount').value)
  const description = document.getElementById('transfer-description').value

  if (!recipientName || !bankName || !recipientAccount || !amount) {
    alert('Please fill in all required fields')
    return
  }

  if (amount <= 0) {
    alert('Please enter a valid amount')
    return
  }

  if (amount > appState.currentUser.account.balance) {
    alert('Insufficient balance')
    return
  }

  // ✅ Just save transfer details - no OTP generation
  appState.currentTransfer = {
    recipientName,
    bankName,
    recipientAccount,
    amount,
    description
  }

  console.log('📝 Transfer details saved (OTP generation skipped)')

  // ✅ Go directly to OTP screen (dummy screen)
  hideModal('recipient-details-modal')
  showOTPModal()
}

function showOTPModal() {
  document.getElementById('otp-email-display').textContent = appState.currentUser.email
  document.getElementById('otp-input').value = ''
  startOTPTimer()
  showModal('otp-modal')
}

async function verifyOTPAndComplete() {
  const enteredOTP = document.getElementById('otp-input').value

  // ✅ Just check if it's 6 digits - accept anything
  if (!enteredOTP || enteredOTP.length !== 6) {
    alert('Please enter a 6-digit code')
    return
  }

  // ✅ Check if it's only numbers
  if (!/^\d{6}$/.test(enteredOTP)) {
    alert('Please enter only numbers (6 digits)')
    return
  }

  console.log('✅ Code accepted:', enteredOTP, '(verification skipped)')

  // ✅ Create the transaction directly
  const txResult = await TransactionManager.createTransaction(
    'OUTGOING',
    appState.currentTransfer.amount,
    appState.currentTransfer.recipientName,
    appState.currentTransfer.bankName,
    appState.currentTransfer.recipientAccount,
    appState.currentTransfer.description
  )

  if (!txResult.success) {
    alert('Transaction failed: ' + txResult.error)
    return
  }

  hideModal('otp-modal')
  showPendingScreen()
}

function showPendingScreen() {
  document.getElementById('pending-recipient').textContent = appState.currentTransfer.recipientName
  document.getElementById('pending-amount').textContent = `-$${appState.currentTransfer.amount.toFixed(2)}`
  showModal('pending-screen')
}
function startOTPTimer() {
  let timeLeft = 300
  const timerDisplay = document.getElementById('otp-timer')
  const updateTimer = () => {
    const mins = Math.floor(timeLeft / 60)
    const secs = timeLeft % 60
    timerDisplay.textContent = `${mins}:${secs.toString().padStart(2, '0')}`
    if (timeLeft > 0) {
      timeLeft--
      setTimeout(updateTimer, 1000)
    } else {
      timerDisplay.textContent = 'Expired'
    }
  }
  updateTimer()
}
// ============================================================================
// EVENT LISTENERS
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Dashboard initializing...')
  let attempts = 0
  while (!window.supabaseClient && attempts < 20) {
    await new Promise(resolve => setTimeout(resolve, 100))
    attempts++
  }
  if (!window.supabaseClient) {
    console.error('❌ window.supabaseClient failed to initialize')
    alert('Database connection error. Please refresh the page.')
    return
  }
  console.log('✅ window.supabaseClient ready')
  if (appState.isDarkMode) {
    document.documentElement.classList.add('dark')
  }
  const hasSession = await AuthManager.checkSession()
  if (hasSession) {
    renderDashboardPage()
  } else {
    renderLoginPage()
  }
  const loginForm = document.getElementById('login-form')
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const email = document.getElementById('login-email').value.trim()
      const password = document.getElementById('login-password').value

      console.log('📧 Attempting login with:', email)

      const result = await AuthManager.login(email, password)

      if (result.success) {
        console.log('✅ Login successful!')
        renderDashboardPage()
      } else {
        console.error('❌ Login failed:', result.error)
        alert('Login failed: ' + result.error)
      }
    })
  }
  const logoutBtn = document.getElementById('logout-btn')
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      AuthManager.logout()
    })
  }
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.id === 'logout-btn' || item.id === 'theme-toggle-btn') return
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'))
      item.classList.add('active')
      renderDashboardContent()
    })
  })
  const themeToggle = document.getElementById('theme-toggle-btn')
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      appState.isDarkMode = !appState.isDarkMode
      document.documentElement.classList.toggle('dark')
      localStorage.setItem('theme', appState.isDarkMode ? 'dark' : 'light')
    })
  }

  // ============================================================================
  // 📱 MOBILE MENU FUNCTIONALITY
  // ============================================================================
  
  const mobileMenuBtn = document.getElementById('mobileMenuToggle')
  const sidebar = document.querySelector('.sidebar')
  const sidebarOverlay = document.getElementById('sidebarOverlay')
  const sidebarCloseBtn = document.getElementById('sidebarClose')
  
  if (mobileMenuBtn && sidebar && sidebarOverlay) {
    // Open sidebar when hamburger is clicked
    mobileMenuBtn.addEventListener('click', function() {
      console.log('📱 Mobile menu opened')
      sidebar.classList.add('mobile-open')
      sidebarOverlay.classList.add('active')
      document.body.style.overflow = 'hidden'
    })
    
    // Close sidebar when overlay is clicked
    sidebarOverlay.addEventListener('click', function() {
      console.log('📱 Mobile menu closed (overlay)')
      sidebar.classList.remove('mobile-open')
      sidebarOverlay.classList.remove('active')
      document.body.style.overflow = ''
    })
    
    // Close sidebar when close button is clicked
    if (sidebarCloseBtn) {
      sidebarCloseBtn.addEventListener('click', function() {
        console.log('📱 Mobile menu closed (button)')
        sidebar.classList.remove('mobile-open')
        sidebarOverlay.classList.remove('active')
        document.body.style.overflow = ''
      })
    }
    
    // Close sidebar when nav item is clicked (on mobile)
    document.querySelectorAll('.nav-item').forEach(function(navItem) {
      navItem.addEventListener('click', function() {
        if (window.innerWidth <= 768) {
          setTimeout(() => {
            sidebar.classList.remove('mobile-open')
            sidebarOverlay.classList.remove('active')
            document.body.style.overflow = ''
          }, 300)
        }
      })
    })
    
    // Close sidebar when escape key is pressed
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && sidebar.classList.contains('mobile-open')) {
        sidebar.classList.remove('mobile-open')
        sidebarOverlay.classList.remove('active')
        document.body.style.overflow = ''
      }
    })
    
    console.log('✅ Mobile menu initialized')
  } else {
    console.warn('⚠️ Mobile menu elements not found')
  }
  
  // ============================================================================
  // END MOBILE MENU
  // ============================================================================

  document.querySelectorAll('.transfer-method-card').forEach(card => {
    card.addEventListener('click', () => {
      appState.currentTransfer.method = card.dataset.method
      hideModal('transfer-method-modal')
      showTransferDetailsModal()
    })
  })
  const transferNextBtn = document.getElementById('transfer-next-otp')
  if (transferNextBtn) {
    transferNextBtn.addEventListener('click', sendOTPAndShowModal)
  }
  const otpSubmitBtn = document.getElementById('otp-submit')
  if (otpSubmitBtn) {
    otpSubmitBtn.addEventListener('click', verifyOTPAndComplete)
  }
  const transferCancel1 = document.getElementById('transfer-cancel-1')
  if (transferCancel1) {
    transferCancel1.addEventListener('click', () => hideModal('transfer-method-modal'))
  }
  const transferCancel2 = document.getElementById('transfer-cancel-2')
  if (transferCancel2) {
    transferCancel2.addEventListener('click', () => hideModal('recipient-details-modal'))
  }
  const otpCancel = document.getElementById('otp-cancel')
  if (otpCancel) {
    otpCancel.addEventListener('click', () => hideModal('otp-modal'))
  }
  const pendingClose = document.getElementById('pending-close')
  if (pendingClose) {
    pendingClose.addEventListener('click', () => {
      hideModal('pending-screen')
      renderDashboardPage()
    })
  }
  console.log('✅ User Dashboard ready')
})
