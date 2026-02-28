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
// COUNTRY → LOCAL BANK CODE CONFIG
// Each entry: { label, placeholder, hint, pattern, errorMsg, required }
// Countries set to required:true will show & require the field.
// Countries set to required:false will show the field but not require it.
// Countries not in this map → field is hidden entirely.
// ============================================================================

const COUNTRY_BANK_CODE = {
  // ── Americas ──
  US: {
    label: 'ABA Routing Number *',
    placeholder: '9-digit routing number',
    hint: 'Enter the routing or bank code required for the recipient’s country.',
    pattern: /^\d{9}$/,
    errorMsg: 'ABA Routing Number must be exactly 9 digits.',
    required: true
  },
  CA: {
    label: 'Transit Number *',
    placeholder: 'DDDDD-BBB (5-digit branch + 3-digit bank)',
    hint: 'Enter the routing or bank code required for the recipient’s country.',
    pattern: /^\d{5}-?\d{3}$/,
    errorMsg: 'Canadian transit number must be 5 branch digits and 3 institution digits (e.g. 12345-006).',
    required: true
  },
  MX: {
    label: 'CLABE *',
    placeholder: '18-digit CLABE number',
    hint: 'Enter the routing or bank code required for the recipient’s country.',
    pattern: /^\d{18}$/,
    errorMsg: 'CLABE must be exactly 18 digits.',
    required: true
  },
  BR: {
    label: 'ISPB / Bank Code *',
    placeholder: '8-digit ISPB code',
    hint: 'Enter the routing or bank code required for the recipient’s country.',
    pattern: /^\d{8}$/,
    errorMsg: 'ISPB must be exactly 8 digits.',
    required: true
  },

  // ── Europe (IBAN countries — Sort Code / BIC usually optional) ──
  GB: {
    label: 'Sort Code *',
    placeholder: 'XX-XX-XX',
    hint: 'Enter the routing or bank code required for the recipient’s country.',
    pattern: /^\d{2}-?\d{2}-?\d{2}$/,
    errorMsg: 'Sort Code must be 6 digits (e.g. 12-34-56).',
    required: true
  },
  DE: {
    label: 'BIC / SWIFT Code',
    placeholder: '8 or 11 character BIC',
    hint: 'Optional for SEPA transfers.',
    pattern: /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/i,
    errorMsg: 'BIC must be 8 or 11 alphanumeric characters.',
    required: false
  },
  FR: {
    label: 'BIC / SWIFT Code',
    placeholder: '8 or 11 character BIC',
    hint: 'Optional for SEPA transfers.',
    pattern: /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/i,
    errorMsg: 'BIC must be 8 or 11 alphanumeric characters.',
    required: false
  },
  ES: {
    label: 'BIC / SWIFT Code',
    placeholder: '8 or 11 character BIC',
    hint: 'Optional for SEPA transfers.',
    pattern: /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/i,
    errorMsg: 'BIC must be 8 or 11 alphanumeric characters.',
    required: false
  },
  IT: {
    label: 'BIC / SWIFT Code',
    placeholder: '8 or 11 character BIC',
    hint: 'Optional for SEPA transfers.',
    pattern: /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/i,
    errorMsg: 'BIC must be 8 or 11 alphanumeric characters.',
    required: false
  },
  NL: {
    label: 'BIC / SWIFT Code',
    placeholder: '8 or 11 character BIC',
    hint: 'Optional for SEPA transfers.',
    pattern: /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/i,
    errorMsg: 'BIC must be 8 or 11 alphanumeric characters.',
    required: false
  },
  CH: {
    label: 'BIC / SWIFT Code',
    placeholder: '8 or 11 character BIC',
    hint: 'Required for SWIFT transfers to Switzerland.',
    pattern: /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/i,
    errorMsg: 'BIC must be 8 or 11 alphanumeric characters.',
    required: false
  },
  SE: {
    label: 'Bankgiro / Clearing Number',
    placeholder: 'e.g. 3300 or 1234-5678',
    hint: 'Swedish clearing number or Bankgiro number.',
    pattern: /^[\d\- ]{4,12}$/,
    errorMsg: 'Please enter a valid Swedish clearing or Bankgiro number.',
    required: false
  },
  NO: {
    label: 'BIC / SWIFT Code',
    placeholder: '8 or 11 character BIC',
    hint: 'Required for international transfers to Norway.',
    pattern: /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/i,
    errorMsg: 'BIC must be 8 or 11 alphanumeric characters.',
    required: false
  },
  DK: {
    label: 'BIC / SWIFT Code',
    placeholder: '8 or 11 character BIC',
    hint: 'Required for international transfers to Denmark.',
    pattern: /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/i,
    errorMsg: 'BIC must be 8 or 11 alphanumeric characters.',
    required: false
  },
  PL: {
    label: 'BIC / SWIFT Code',
    placeholder: '8 or 11 character BIC',
    hint: 'Required for international SWIFT transfers to Poland.',
    pattern: /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/i,
    errorMsg: 'BIC must be 8 or 11 alphanumeric characters.',
    required: false
  },
  PT: {
    label: 'BIC / SWIFT Code',
    placeholder: '8 or 11 character BIC',
    hint: 'Optional for SEPA, required for SWIFT.',
    pattern: /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/i,
    errorMsg: 'BIC must be 8 or 11 alphanumeric characters.',
    required: false
  },

  // ── Asia-Pacific ──
  AU: {
    label: 'BSB Number *',
    placeholder: 'XXX-XXX',
    hint: 'Australian BSB (Bank State Branch) — 6 digits.',
    pattern: /^\d{3}-?\d{3}$/,
    errorMsg: 'BSB must be 6 digits (e.g. 062-000).',
    required: true
  },
  NZ: {
    label: 'Bank Branch Code *',
    placeholder: 'XX-XXXX (bank-branch)',
    hint: 'Enter the routing or bank code required for the recipient’s country.',
    pattern: /^\d{2}-?\d{4}$/,
    errorMsg: 'NZ Bank Branch must be 6 digits (e.g. 01-0102).',
    required: true
  },
  JP: {
    label: 'Zengin Bank Code *',
    placeholder: '4-digit bank code',
    hint: 'Japanese Zengin bank code — 4 digits.',
    pattern: /^\d{4}$/,
    errorMsg: 'Zengin bank code must be exactly 4 digits.',
    required: true
  },
  CN: {
    label: 'CNAPS Code *',
    placeholder: '12-digit CNAPS code',
    hint: 'Chinese National Advanced Payment System code — 12 digits.',
    pattern: /^\d{12}$/,
    errorMsg: 'CNAPS code must be exactly 12 digits.',
    required: true
  },
  IN: {
    label: 'IFSC Code *',
    placeholder: 'e.g. HDFC0001234',
    hint: 'Indian Financial System Code.',
    pattern: /^[A-Z]{4}0[A-Z0-9]{6}$/i,
    errorMsg: 'IFSC must be 11 characters (e.g. HDFC0001234).',
    required: true
  },
  SG: {
    label: 'Bank Code *',
    placeholder: '4-digit bank code',
    hint: 'Singapore bank code — 4 digits.',
    pattern: /^\d{4}$/,
    errorMsg: 'Singapore bank code must be exactly 4 digits.',
    required: true
  },
  HK: {
    label: 'Bank Code *',
    placeholder: '3-digit bank code',
    hint: 'Hong Kong bank code — 3 digits.',
    pattern: /^\d{3}$/,
    errorMsg: 'Hong Kong bank code must be exactly 3 digits.',
    required: true
  },
  KR: {
    label: 'Bank Code *',
    placeholder: '3-digit bank code',
    hint: 'South Korean bank code — 3 digits.',
    pattern: /^\d{3}$/,
    errorMsg: 'South Korean bank code must be exactly 3 digits.',
    required: true
  },
  MY: {
    label: 'IBG Bank Code *',
    placeholder: '2-digit IBG code',
    hint: 'Malaysia IBG (Interbank GIRO) bank code — 2 digits.',
    pattern: /^\d{2}$/,
    errorMsg: 'Malaysia IBG bank code must be exactly 2 digits.',
    required: true
  },
  PH: {
    label: 'Bank Code *',
    placeholder: '4-digit bank code',
    hint: 'Philippine bank code — 4 digits.',
    pattern: /^\d{4}$/,
    errorMsg: 'Philippine bank code must be exactly 4 digits.',
    required: true
  },
  TH: {
    label: 'BAHTNET Bank Code *',
    placeholder: '3-digit bank code',
    hint: 'Thai BAHTNET bank code — 3 digits.',
    pattern: /^\d{3}$/,
    errorMsg: 'Thai bank code must be exactly 3 digits.',
    required: true
  },
  ID: {
    label: 'Bank Code *',
    placeholder: '3-digit bank code',
    hint: 'Indonesian bank code — 3 digits.',
    pattern: /^\d{3}$/,
    errorMsg: 'Indonesian bank code must be exactly 3 digits.',
    required: true
  },

  // ── Middle East & Africa ──
  AE: {
    label: 'BIC / SWIFT Code',
    placeholder: '8 or 11 character BIC',
    hint: 'Required for transfers to the UAE.',
    pattern: /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/i,
    errorMsg: 'BIC must be 8 or 11 alphanumeric characters.',
    required: false
  },
  SA: {
    label: 'BIC / SWIFT Code',
    placeholder: '8 or 11 character BIC',
    hint: 'Required for transfers to Saudi Arabia.',
    pattern: /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/i,
    errorMsg: 'BIC must be 8 or 11 alphanumeric characters.',
    required: false
  },
  NG: {
    label: 'Sort Code *',
    placeholder: '6-digit sort code',
    hint: 'Nigerian bank sort code — 6 digits.',
    pattern: /^\d{6}$/,
    errorMsg: 'Nigerian sort code must be exactly 6 digits.',
    required: true
  },
  ZA: {
    label: 'Branch Code *',
    placeholder: '6-digit branch code',
    hint: 'South African bank branch code — 6 digits.',
    pattern: /^\d{6}$/,
    errorMsg: 'South African branch code must be exactly 6 digits.',
    required: true
  },
  KE: {
    label: 'Bank Code *',
    placeholder: '5-digit bank code',
    hint: 'Kenyan bank code — typically 5 digits.',
    pattern: /^\d{5}$/,
    errorMsg: 'Kenyan bank code must be exactly 5 digits.',
    required: true
  },
  GH: {
    label: 'Bank Code *',
    placeholder: '6-digit bank code',
    hint: 'Ghanaian bank code — 6 digits.',
    pattern: /^\d{6}$/,
    errorMsg: 'Ghanaian bank code must be exactly 6 digits.',
    required: true
  },
  EG: {
    label: 'BIC / SWIFT Code',
    placeholder: '8 or 11 character BIC',
    hint: 'Required for international transfers to Egypt.',
    pattern: /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/i,
    errorMsg: 'BIC must be 8 or 11 alphanumeric characters.',
    required: false
  },

  // OTHER → hide field entirely (handled in JS)
  OTHER: null
}

// ============================================================================
// AUTO-REFRESH SYSTEM
// ============================================================================

async function startAutoRefresh() {
  appState.autoRefreshInterval = setInterval(async () => {
    if (!appState.isLoggedIn || !appState.currentUser) return
    try {
      const { data: account } = await window.supabaseClient
        .from('accounts')
        .select('*')
        .eq('id', appState.currentUser.account.id)
        .single()

      if (account && account.balance !== appState.currentUser.account.balance) {
        appState.currentUser.account.balance = account.balance
        const activeSection = document.querySelector('.nav-item.active')?.dataset.section
        if (activeSection === 'dashboard') await renderDashboardOverview()
        else if (activeSection === 'wallet') renderWalletPage()
        else if (activeSection === 'messages') await renderMessagesPage()
      }
    } catch (error) {
      console.error('Auto-refresh failed:', error)
    }
  }, 10000)
}

function stopAutoRefresh() {
  if (appState.autoRefreshInterval) {
    clearInterval(appState.autoRefreshInterval)
    appState.autoRefreshInterval = null
  }
}

// ============================================================================
// AUTHENTICATION SYSTEM
// ============================================================================

class AuthManager {
  static async login(email, password) {
    try {
      const { data: authData, error: authError } = await window.supabaseClient.auth.signInWithPassword({
        email,
        password
      })

      if (authError || !authData.user) {
        return { success: false, error: authError?.message || 'Invalid email or password' }
      }

      const { data: profile, error: profileError } = await window.supabaseClient
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single()

      if (profileError) {
        await window.supabaseClient.from('users').insert({
          id: authData.user.id,
          email: authData.user.email,
          name: authData.user.user_metadata?.full_name || authData.user.email.split('@')[0]
        }).select().single()
      }

      const { data: account, error: accountError } = await window.supabaseClient
        .from('accounts')
        .select('*')
        .eq('user_id', authData.user.id)
        .single()

      if (accountError) {
        const accountNumber = 'ACC' + Math.random().toString().slice(2, 12)
        const { data: newAccount, error: createAccError } = await window.supabaseClient
          .from('accounts')
          .insert({ user_id: authData.user.id, account_number: accountNumber, balance: 5000.00 })
          .select().single()

        if (createAccError) return { success: false, error: 'Failed to create account' }

        appState.currentUser = {
          id: authData.user.id,
          email: authData.user.email,
          name: profile?.name || authData.user.email.split('@')[0],
          account: newAccount
        }
      } else {
        appState.currentUser = {
          id: authData.user.id,
          email: authData.user.email,
          name: profile?.name || authData.user.email.split('@')[0],
          account
        }
      }

      appState.isLoggedIn = true
      startAutoRefresh()
      return { success: true, user: authData.user }
    } catch (error) {
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
      const { data: { session }, error } = await window.supabaseClient.auth.getSession()
      if (error || !session) return false

      const { data: profile } = await window.supabaseClient
        .from('users').select('*').eq('id', session.user.id).single()

      const { data: account } = await window.supabaseClient
        .from('accounts').select('*').eq('user_id', session.user.id).single()

      if (!account) return false

      appState.currentUser = {
        id: session.user.id,
        email: session.user.email,
        name: profile?.name || session.user.email.split('@')[0],
        account
      }
      appState.isLoggedIn = true
      startAutoRefresh()
      return true
    } catch (error) {
      return false
    }
  }
}

// ============================================================================
// OTP MANAGER
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
        .insert({ user_id: appState.currentUser.id, otp_hash: hashedOTP, expires_at: expiresAt, attempts: 0 })
        .select().single()

      if (dbError) throw dbError

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${CONFIG.resend.apiKey}`, 'Content-Type': 'application/json' },
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

      if (!emailResponse.ok) throw new Error('Failed to send email')

      return { success: true, otpId: otpRecord.id, plainOTP: otp }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  static async verifyOTP(otpId, enteredOTP) {
    try {
      const { data: otpRecord, error } = await window.supabaseClient
        .from('otp_codes').select('*').eq('id', otpId).single()

      if (error || !otpRecord) return { success: false, error: 'Invalid OTP' }
      if (new Date(otpRecord.expires_at) < new Date()) return { success: false, error: 'OTP expired' }
      if (otpRecord.attempts >= 3) return { success: false, error: 'Too many attempts' }

      const enteredHash = await this.hashOTP(enteredOTP)
      if (enteredHash !== otpRecord.otp_hash) {
        await window.supabaseClient.from('otp_codes')
          .update({ attempts: otpRecord.attempts + 1 }).eq('id', otpId)
        return { success: false, error: 'Invalid OTP' }
      }

      await window.supabaseClient.from('otp_codes').update({ used: true }).eq('id', otpId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
}

// ============================================================================
// TRANSACTION MANAGER
// ============================================================================

class TransactionManager {
  static async createTransaction(type, amount, recipientName, bankName, accountNumber, description, country, localBankCode) {
    try {
      if (type === 'OUTGOING') {
        const newBalance = appState.currentUser.account.balance - amount
        await window.supabaseClient.from('accounts')
          .update({ balance: newBalance }).eq('id', appState.currentUser.account.id)
        appState.currentUser.account.balance = newBalance
      }

      const { data: transaction, error } = await window.supabaseClient
        .from('transactions')
        .insert({
          account_id: appState.currentUser.account.id,
          type,
          amount,
          recipient_name: recipientName,
          recipient_bank: bankName,
          recipient_account: accountNumber,
          description,
          status: 'PENDING',
          // New fields — safely null for countries that don't use them
          recipient_country: country || null,
          local_bank_code: localBankCode || null
        })
        .select().single()

      if (error) throw error
      return { success: true, transaction }
    } catch (error) {
      console.error('Transaction creation failed:', error)
      return { success: false, error: error.message }
    }
  }

  static async getTransactions() {
    try {
      const { data, error } = await window.supabaseClient
        .from('transactions').select('*')
        .eq('account_id', appState.currentUser.account.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    } catch (error) {
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
    return { incomingTotal: incoming, outgoingTotal: outgoing, transactionCount: transactions.length, pendingCount: pending }
  }
}

// ============================================================================
// LOCAL BANK CODE FIELD — show / hide / configure
// ============================================================================

function updateLocalCodeField(countryCode) {
  const wrapper  = document.getElementById('local-code-wrapper')
  const labelEl  = document.getElementById('local-code-label')
  const inputEl  = document.getElementById('recipient-local-code')
  const hintEl   = document.getElementById('local-code-hint')
  const errorEl  = document.getElementById('local-code-error')

  if (!wrapper || !inputEl) return

  // Clear previous state
  inputEl.value = ''
  inputEl.classList.remove('input-error')
  if (errorEl) { errorEl.classList.remove('show'); errorEl.textContent = '' }

  const config = COUNTRY_BANK_CODE[countryCode]

  // No config or explicitly null → hide
  if (!config) {
    wrapper.classList.remove('visible')
    inputEl.removeAttribute('required')
    return
  }

  // Apply config
  if (labelEl) labelEl.textContent = config.label
  inputEl.placeholder = config.placeholder
  if (hintEl)  hintEl.textContent  = config.hint
  if (errorEl) errorEl.textContent  = config.errorMsg

  if (config.required) {
    inputEl.setAttribute('required', 'required')
  } else {
    inputEl.removeAttribute('required')
  }

  // Show with animation
  wrapper.classList.add('visible')
}

function validateLocalCode(countryCode, value) {
  const config = COUNTRY_BANK_CODE[countryCode]
  if (!config) return true                    // hidden → always valid
  if (!config.required && !value.trim()) return true  // optional + empty → valid
  return config.pattern.test(value.trim())
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
  if (welcomeEl) welcomeEl.textContent = `Welcome, ${appState.currentUser.name}`

  const pageTitle = document.getElementById('page-title')
  if (pageTitle) pageTitle.textContent = 'Dashboard'

  renderDashboardContent()
  updateNotificationBadge()
}

async function renderDashboardContent() {
  const activeSection = document.querySelector('.nav-item.active')?.dataset.section || 'dashboard'
  const pageTitle = document.getElementById('page-title')
  if (pageTitle) pageTitle.textContent = activeSection.charAt(0).toUpperCase() + activeSection.slice(1)

  switch (activeSection) {
    case 'dashboard':    await renderDashboardOverview(); break
    case 'wallet':       renderWalletPage(); break
    case 'transactions': await renderTransactionsPage(); break
    case 'messages':     await renderMessagesPage(); break
    case 'profile':      renderProfilePage(); break
  }
}

async function renderDashboardOverview() {
  const container = document.getElementById('content-container')
  const stats = await TransactionManager.getStats()
  const transactions = await TransactionManager.getTransactions()
  const recent = transactions.slice(0, 5)

  const html = `
    <div class="space-y-6">
      <div class="card">
        <div class="card-header"><h2 class="card-title">Account Balance</h2></div>
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
                      'bg-red-100 text-red-700'}">${txn.status}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `<p class="text-center text-muted-foreground py-8">No transactions yet</p>`}
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
      document.getElementById('transactions-list-container').innerHTML =
        renderTransactionsList(transactions, btn.dataset.filter)
    })
  })
}

function renderTransactionsList(transactions, filter) {
  let filtered = transactions
  if (filter === 'INCOMING') filtered = transactions.filter(t => t.type === 'INCOMING')
  else if (filter === 'OUTGOING') filtered = transactions.filter(t => t.type === 'OUTGOING')
  else if (filter === 'PENDING') filtered = transactions.filter(t => t.status === 'PENDING')

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
              'bg-red-100 text-red-700'}">${txn.status}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `
}

async function renderMessagesPage() {
  const container = document.getElementById('content-container')
  try {
    const { data: messages, error } = await window.supabaseClient
      .from('messages').select('*')
      .eq('user_id', appState.currentUser.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    const unreadIds = messages.filter(msg => msg.is_read === false).map(msg => msg.id)
    if (unreadIds.length > 0) {
      await window.supabaseClient.from('messages').update({ is_read: true }).in('id', unreadIds)
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
    const { data: unreadMessages } = await window.supabaseClient
      .from('messages').select('id')
      .eq('user_id', appState.currentUser.id)
      .eq('is_read', false)

    const unreadCount = unreadMessages?.length || 0
    const badge = document.getElementById('userNotificationBadge')
    if (badge) {
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount
      badge.style.display = unreadCount > 0 ? 'flex' : 'none'
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
// TRANSFER FLOW
// ============================================================================

function openTransferFlow() {
  appState.currentTransfer = {
    method: null,
    recipientName: '',
    bankName: '',
    recipientAccount: '',
    amount: 0,
    description: '',
    country: '',
    localBankCode: ''
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

  // Reset country + local code field on each open
  const countryEl = document.getElementById('recipient-country')
  if (countryEl) countryEl.value = ''
  updateLocalCodeField('')   // hides the field

  showModal('recipient-details-modal')
}

async function sendOTPAndShowModal() {
  const recipientName    = document.getElementById('recipient-name').value.trim()
  const bankName         = document.getElementById('recipient-bank').value.trim()
  const recipientAccount = document.getElementById('recipient-account').value.trim()
  const amount           = parseFloat(document.getElementById('transfer-amount').value)
  const description      = document.getElementById('transfer-description').value.trim()
  const country          = document.getElementById('recipient-country')?.value || ''
  const localBankCode    = document.getElementById('recipient-local-code')?.value.trim() || ''

  // ── Basic validation ──
  if (!recipientName || !bankName || !recipientAccount || !amount || !country) {
    alert('Please fill in all required fields including the destination country.')
    return
  }

  if (amount <= 0) {
    alert('Please enter a valid amount.')
    return
  }

  if (amount > appState.currentUser.account.balance) {
    alert('Insufficient balance.')
    return
  }

  // ── Local bank code validation ──
  const codeInput = document.getElementById('recipient-local-code')
  const errorEl   = document.getElementById('local-code-error')
  const config    = COUNTRY_BANK_CODE[country]

  if (config) {
    const isValid = validateLocalCode(country, localBankCode)
    if (!isValid) {
      if (errorEl) errorEl.classList.add('show')
      if (codeInput) { codeInput.classList.add('input-error'); codeInput.focus() }
      return
    } else {
      if (errorEl) errorEl.classList.remove('show')
      if (codeInput) codeInput.classList.remove('input-error')
    }
  }

  // ── Save transfer state ──
  appState.currentTransfer = {
    recipientName,
    bankName,
    recipientAccount,
    amount,
    description,
    country,
    localBankCode
  }

  console.log('📝 Transfer details saved:', appState.currentTransfer)

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

  if (!enteredOTP || enteredOTP.length !== 6) {
    alert('Please enter a 6-digit code')
    return
  }

  if (!/^\d{6}$/.test(enteredOTP)) {
    alert('Please enter only numbers (6 digits)')
    return
  }

  const txResult = await TransactionManager.createTransaction(
    'OUTGOING',
    appState.currentTransfer.amount,
    appState.currentTransfer.recipientName,
    appState.currentTransfer.bankName,
    appState.currentTransfer.recipientAccount,
    appState.currentTransfer.description,
    appState.currentTransfer.country,
    appState.currentTransfer.localBankCode
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
    if (timeLeft > 0) { timeLeft--; setTimeout(updateTimer, 1000) }
    else timerDisplay.textContent = 'Expired'
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
    alert('Database connection error. Please refresh the page.')
    return
  }

  if (appState.isDarkMode) document.documentElement.classList.add('dark')

  const hasSession = await AuthManager.checkSession()
  if (hasSession) renderDashboardPage()
  else renderLoginPage()

  // ── Login form ──
  const loginForm = document.getElementById('login-form')
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const email    = document.getElementById('login-email').value.trim()
      const password = document.getElementById('login-password').value
      const result   = await AuthManager.login(email, password)
      if (result.success) renderDashboardPage()
      else alert('Login failed: ' + result.error)
    })
  }

  // ── Logout ──
  document.getElementById('logout-btn')?.addEventListener('click', () => AuthManager.logout())

  // ── Nav items ──
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.id === 'logout-btn' || item.id === 'theme-toggle-btn') return
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'))
      item.classList.add('active')
      renderDashboardContent()
    })
  })

  // ── Theme toggle ──
  document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
    appState.isDarkMode = !appState.isDarkMode
    document.documentElement.classList.toggle('dark')
    localStorage.setItem('theme', appState.isDarkMode ? 'dark' : 'light')
  })

  // ── Mobile menu ──
  const mobileMenuBtn  = document.getElementById('mobileMenuToggle')
  const sidebar        = document.querySelector('.sidebar')
  const sidebarOverlay = document.getElementById('sidebarOverlay')
  const sidebarCloseBtn = document.getElementById('sidebarClose')

  if (mobileMenuBtn && sidebar && sidebarOverlay) {
    mobileMenuBtn.addEventListener('click', () => {
      sidebar.classList.add('mobile-open')
      sidebarOverlay.classList.add('active')
      document.body.style.overflow = 'hidden'
    })
    sidebarOverlay.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open')
      sidebarOverlay.classList.remove('active')
      document.body.style.overflow = ''
    })
    sidebarCloseBtn?.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open')
      sidebarOverlay.classList.remove('active')
      document.body.style.overflow = ''
    })
    document.querySelectorAll('.nav-item').forEach(navItem => {
      navItem.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          setTimeout(() => {
            sidebar.classList.remove('mobile-open')
            sidebarOverlay.classList.remove('active')
            document.body.style.overflow = ''
          }, 300)
        }
      })
    })
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('mobile-open')) {
        sidebar.classList.remove('mobile-open')
        sidebarOverlay.classList.remove('active')
        document.body.style.overflow = ''
      }
    })
  }

  // ── Transfer method cards ──
  document.querySelectorAll('.transfer-method-card').forEach(card => {
    card.addEventListener('click', () => {
      appState.currentTransfer.method = card.dataset.method
      hideModal('transfer-method-modal')
      showTransferDetailsModal()
    })
  })

  // ── Country dropdown → update local bank code field ──
  const countrySelect = document.getElementById('recipient-country')
  if (countrySelect) {
    countrySelect.addEventListener('change', function () {
      updateLocalCodeField(this.value)
    })
  }

  // ── Local code input: digits-only enforcement + clear error on type ──
  const localCodeInput = document.getElementById('recipient-local-code')
  if (localCodeInput) {
    localCodeInput.addEventListener('input', function () {
      const country = document.getElementById('recipient-country')?.value || ''
      const config  = COUNTRY_BANK_CODE[country]

      // If pattern is purely numeric, strip non-digits automatically
      if (config && /^\^\\d/.test(config.pattern.source)) {
        this.value = this.value.replace(/[^\d\-]/g, '')
      }

      // Clear inline error as user types
      const errorEl = document.getElementById('local-code-error')
      if (errorEl) errorEl.classList.remove('show')
      this.classList.remove('input-error')
    })
  }

  // ── Transfer next (Send OTP) ──
  document.getElementById('transfer-next-otp')?.addEventListener('click', sendOTPAndShowModal)

  // ── OTP submit ──
  document.getElementById('otp-submit')?.addEventListener('click', verifyOTPAndComplete)

  // ── Cancel buttons ──
  document.getElementById('transfer-cancel-1')?.addEventListener('click', () => hideModal('transfer-method-modal'))
  document.getElementById('transfer-cancel-2')?.addEventListener('click', () => hideModal('recipient-details-modal'))
  document.getElementById('otp-cancel')?.addEventListener('click', () => hideModal('otp-modal'))

  // ── Pending close ──
  document.getElementById('pending-close')?.addEventListener('click', () => {
    hideModal('pending-screen')
    renderDashboardPage()
  })

  console.log('✅ User Dashboard ready')
})
