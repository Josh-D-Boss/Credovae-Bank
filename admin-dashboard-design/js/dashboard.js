// ============================================================================
// ACADEMIC BANKING SYSTEM - ADMIN CONTROL PANEL
// Supabase-Integrated Banking System with Transaction Approvals
// ============================================================================

// GLOBAL STATE & DATA STRUCTURES
// ============================================================================

let currentTheme = localStorage.getItem("theme") || "light"
let currentPage = "dashboard"
let sidebarCollapsed = false
let currentEditingUser = null
let currentApprovingTransaction = null

// RBAC Session Tracking (NEW)
let currentAdminSession = null
let currentAdminRole = null

// Database data from Supabase
let students = [] // Fetched from 'user' table
let accounts = [] // Fetched from 'accounts' table
let transactions = [] // Fetched from 'transactions' table
let notifications = []

// Pagination State
let userCurrentPage = 1
let txCurrentPage = 1
const itemsPerPage = 10
let filteredStudents = [...students]
let filteredTransactions = [...transactions]

// ============================================================================
// SUPABASE INITIALIZATION
// ============================================================================

// Create supabase client
window.supabaseClient = null

function initializeSupabase() {
  if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
    window.supabaseClient = window.supabase.createClient(
      'https://hhudykraoahdkhkzmzcb.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhodWR5a3Jhb2FoZGtoa3ptemNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NzU3NjEsImV4cCI6MjA4NDM1MTc2MX0.xeN-PKlcpF_pAAO-VxMLBpgKxZmetJQBAJR708HDfQU'
    )
    console.log('✅ Supabase client initialized in admin dashboard')
    return true
  } else {
    console.error('❌ Supabase SDK not available')
    return false
  }
}

// ============================================================================
// RBAC INITIALIZATION (NEW)
// ============================================================================

function initRBAC() {
  const session = localStorage.getItem('admin_session')
  if (session) {
    try {
      currentAdminSession = JSON.parse(session)
      currentAdminRole = currentAdminSession.role
      console.log('✅ RBAC initialized. Role:', currentAdminRole)
      
      // ✅ Start auto-updating last_seen
      startLastSeenUpdater()
    } catch (error) {
      console.error('❌ Failed to parse admin session:', error)
    }
  }
}

// ✅ AUTO-UPDATE LAST_SEEN EVERY 2 MINUTES
function startLastSeenUpdater() {
  if (!currentAdminSession || !currentAdminSession.userId) return
  
  // Update immediately
  updateLastSeen()
  
  // Then update every 2 minutes
  setInterval(() => {
    updateLastSeen()
  }, 2 * 60 * 1000) // 2 minutes
}

async function updateLastSeen() {
  if (!currentAdminSession || !currentAdminSession.userId) return
  
  try {
    const { error } = await window.supabaseClient
      .from('users')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', currentAdminSession.userId)
    
    if (error) {
      console.error('Failed to update last_seen:', error)
    } else {
      console.log('📡 Last seen updated')
    }
  } catch (error) {
    console.error('Error updating last_seen:', error)
  }
}

// ============================================================================
// DATA FETCHING FROM SUPABASE
// ============================================================================

async function loadAllData() {
  try {
    console.log('📥 Loading data from Supabase...')

    // ✅ Load users with RBAC columns and filtering
    let userQuery = window.supabaseClient
      .from('users')
      .select('id, email, name, password, role, is_active, last_seen, created_at')
      .order('created_at', { ascending: false })

    // ✅ Role-based filtering
    if (currentAdminRole === 'admin') {
      // Regular admins cannot see master admins
      userQuery = userQuery.neq('role', 'master_admin')
    }
    // Master admins see everyone (no filter needed)

    const { data: userData, error: userError } = await userQuery

    if (userError) {
      console.error('Error loading users:', userError)
      throw userError
    }

    console.log('Raw user data:', userData)

    // ✅ Load accounts
    const { data: accountData, error: accountError } = await window.supabaseClient
      .from('accounts')
      .select('*')

    if (accountError) {
      console.error('Error loading accounts:', accountError)
      throw accountError
    }

    console.log('Raw account data:', accountData)

    // ✅ Load transactions
    const { data: txData, error: txError } = await window.supabaseClient
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })

    if (txError) {
      console.error('Error loading transactions:', txError)
      throw txError
    }

    console.log('Raw transaction data:', txData)

    // ✅ Map data correctly with RBAC fields
    students = (userData || []).map(user => ({
      id: user.id,
      name: user.name || user.email.split('@')[0],
      email: user.email,
      userId: user.id,
      role: user.role || 'user',
      is_active: user.is_active !== false,
      last_seen: user.last_seen,
      status: 'Active',
      createdAt: user.created_at || new Date().toISOString()
    }))

    accounts = accountData || []

    // ✅ Merge account info with students
    students = students.map(student => {
      const account = accounts.find(a => a.user_id === student.userId)
      return {
        ...student,
        accountNumber: account?.account_number || 'N/A',
        balance: account?.balance || 0,
        accountId: account?.id
      }
    })

    // ✅ Map transactions with correct field names
    transactions = (txData || []).map(tx => ({
      id: tx.id,
      transactionId: tx.id,
      accountId: tx.account_id,
      type: tx.type === 'OUTGOING' ? 'Debit' : 'Credit',
      amount: parseFloat(tx.amount),
      status: tx.status === 'PENDING' ? 'Pending' :
        tx.status === 'SUCCESSFUL' ? 'Approved' : 'Rejected',
      date: tx.created_at,
      description: tx.description || '',
      recipientName: tx.recipient_name || '',
      recipientBank: tx.recipient_bank || '',
      recipientAccount: tx.recipient_account || '',
      otp: tx.otp_code || '',
      studentId: '',
      userName: '',
      createdAt: tx.created_at
    }))

    // ✅ Link transactions to students
    transactions = transactions.map(tx => {
      const account = accounts.find(a => a.id === tx.accountId)
      const student = students.find(s => s.accountId === tx.accountId)
      return {
        ...tx,
        studentId: student?.id || '',
        userName: student?.name || 'Unknown',
        userId: account?.user_id || ''
      }
    })

    console.log('✅ Data loaded successfully')
    console.log('Users:', students.length)
    console.log('Accounts:', accounts.length)
    console.log('Transactions:', transactions.length)
    console.log('Student sample:', students.slice(0, 2))
    console.log('Transaction sample:', transactions.slice(0, 2))

    // Reset filtered arrays
    filteredStudents = [...students]
    filteredTransactions = [...transactions]

  } catch (error) {
    console.error('❌ Failed to load data from Supabase:', error)
    addNotification(`Database error: ${error.message}`)
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener("DOMContentLoaded", async () => {
  // Initialize Supabase first
  if (!initializeSupabase()) {
    console.warn('⚠️ Supabase not ready, will retry on window load')
    window.addEventListener('load', async () => {
      if (!initializeSupabase()) {
        addNotification('Failed to connect to database')
        return
      }
      initRBAC()
      await loadAllData()
      initializeTheme()
      initializeNavigation()
      initializeEventListeners()
      updateDashboard()
    })
  } else {
    initRBAC()
    await loadAllData()
    initializeTheme()
    initializeNavigation()
    initializeEventListeners()
    updateDashboard()
  }
})

// ============================================================================
// THEME MANAGEMENT
// ============================================================================

function initializeTheme() {
  document.body.className = currentTheme + "-theme"
}

function toggleTheme() {
  currentTheme = currentTheme === "light" ? "dark" : "light"
  document.body.className = currentTheme + "-theme"
  localStorage.setItem("theme", currentTheme)
}

// ============================================================================
// NAVIGATION & PAGE MANAGEMENT
// ============================================================================

function initializeNavigation() {
  const navItems = document.querySelectorAll(".nav-item")
  navItems.forEach((item) => {
    item.addEventListener("click", function (e) {
      e.preventDefault()
      const page = this.getAttribute("data-page")
      navigateToPage(page)
    })
  })
}

function navigateToPage(page) {
  // Update active nav item
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active")
  })

  // ✅ FIX: Add null check
  const targetNav = document.querySelector(`[data-page="${page}"]`)
  if (targetNav) {
    targetNav.classList.add("active")
  }

  // Hide all pages
  document.querySelectorAll(".page").forEach((pageEl) => {
    pageEl.classList.add("hidden")
  })

  // Show selected page
  const targetPage = document.getElementById(page + "-page")
  if (targetPage) {
    targetPage.classList.remove("hidden")
  }

  // Update page title
  const pageTitles = {
    dashboard: "Dashboard",
    users: "User Management",
    transactions: "Transaction History",
    approvals: "Transaction Approvals",
    simulate: "Transaction Simulator",
    notifications: "Notifications",
    settings: "Settings",
    profile: "My Profile"
  }
  document.getElementById("pageTitle").textContent = pageTitles[page] || "Dashboard"

  currentPage = page

  // Load page-specific data
  if (page === "dashboard") {
    updateDashboard()
  } else if (page === "users") {
    updateUserStats()
    filterAndRenderStudents()
  } else if (page === "transactions") {
    updateTransactionStats()
    filterAndRenderTransactions()
  } else if (page === "approvals") {
    updateApprovalsPage()
  } else if (page === "simulate") {
    populateStudentSelect()
    updateSimulateStats()
  } else if (page === "notifications") {
    renderNotifications()
  } else if (page === "profile") {
    loadProfilePage()
  }

  // Close sidebar on mobile
  const sidebar = document.getElementById("sidebar")
  if (sidebar.classList.contains("mobile-open")) {
    sidebar.classList.remove("mobile-open")
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// ============================================================================
// FIXED initializeEventListeners() Function
// Replace the entire function in dashboard.js (around line 400)
// ============================================================================

function initializeEventListeners() {
  console.log('🔧 Initializing event listeners...')
  
  // ✅ Close all modals on page load
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.classList.remove('show')
  })
  console.log('✅ Modals closed')

  // Theme toggle
  const themeToggle = document.getElementById("themeToggle")
  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme)
    console.log('✅ Theme toggle attached')
  }

  // Sidebar toggle
  const sidebarToggle = document.getElementById("sidebarToggle")
  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", toggleSidebar)
    console.log('✅ Sidebar toggle attached')
  }

  // Mobile menu toggle
  const mobileMenuToggle = document.getElementById("mobileMenuToggle")
  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener("click", toggleMobileSidebar)
    console.log('✅ Mobile menu toggle attached')
  }

  // User menu toggle
  const userMenuToggle = document.getElementById("userMenuToggle")
  if (userMenuToggle) {
    userMenuToggle.addEventListener("click", toggleUserMenu)
    console.log('✅ User menu toggle attached')
  }

  // Close user menu when clicking outside
  document.addEventListener("click", (e) => {
    const userMenu = document.getElementById("userDropdown")
    const userMenuToggle = document.getElementById("userMenuToggle")
    if (userMenu && userMenuToggle && !userMenu.contains(e.target) && !userMenuToggle.contains(e.target)) {
      userMenu.classList.remove("show")
    }
  })

  // ✅ FIX: Add User Button - Single listener with role support
  const addUserBtn = document.getElementById("addUserBtn")
  if (addUserBtn) {
    addUserBtn.addEventListener("click", () => {
      console.log('🔵 Add User button clicked!')
      
      // Show modal
      openModal("createUserModal")
      
      // ✅ Show/hide role dropdown based on admin role
      setTimeout(() => {
        const roleGroup = document.getElementById('roleSelectGroup')
        if (roleGroup) {
          if (currentAdminRole === 'master_admin') {
            roleGroup.style.display = 'block'
            console.log('✅ Role dropdown shown for master admin')
          } else {
            roleGroup.style.display = 'none'
            console.log('ℹ️ Role dropdown hidden for regular admin')
          }
        }
      }, 100)
    })
    console.log('✅ Add User button listener attached')
  } else {
    console.error('❌ Add User button not found!')
  }

  // User search and filters
  const userSearch = document.getElementById("userSearch")
  if (userSearch) {
    userSearch.addEventListener("input", filterStudents)
    console.log('✅ User search attached')
  }

  const statusFilter = document.getElementById("statusFilter")
  if (statusFilter) {
    statusFilter.addEventListener("change", filterStudents)
    console.log('✅ Status filter attached')
  }

  const prevPage = document.getElementById("prevPage")
  if (prevPage) {
    prevPage.addEventListener("click", () => changeUserPage(-1))
    console.log('✅ Prev page attached')
  }

  const nextPage = document.getElementById("nextPage")
  if (nextPage) {
    nextPage.addEventListener("click", () => changeUserPage(1))
    console.log('✅ Next page attached')
  }

  // Transactions
  const transactionSearch = document.getElementById("transactionSearch")
  if (transactionSearch) {
    transactionSearch.addEventListener("input", filterTransactions)
    console.log('✅ Transaction search attached')
  }

  const transactionStatusFilter = document.getElementById("transactionStatusFilter")
  if (transactionStatusFilter) {
    transactionStatusFilter.addEventListener("change", filterTransactions)
    console.log('✅ Transaction status filter attached')
  }

  const transactionTypeFilter = document.getElementById("transactionTypeFilter")
  if (transactionTypeFilter) {
    transactionTypeFilter.addEventListener("change", filterTransactions)
    console.log('✅ Transaction type filter attached')
  }

  const txPrevPage = document.getElementById("txPrevPage")
  if (txPrevPage) {
    txPrevPage.addEventListener("click", () => changeTransactionPage(-1))
    console.log('✅ TX prev page attached')
  }

  const txNextPage = document.getElementById("txNextPage")
  if (txNextPage) {
    txNextPage.addEventListener("click", () => changeTransactionPage(1))
    console.log('✅ TX next page attached')
  }

  // Simulate
  const generateSimOTPBtn = document.getElementById("generateSimOTPBtn")
  if (generateSimOTPBtn) {
    generateSimOTPBtn.addEventListener("click", generateSimulationOTP)
    console.log('✅ Generate OTP button attached')
  }

  const simulateTransactionForm = document.getElementById("simulateTransactionForm")
  if (simulateTransactionForm) {
    simulateTransactionForm.addEventListener("submit", submitSimulatedTransaction)
    console.log('✅ Simulate form attached')
  }

  // Settings
  const clearDataBtn = document.getElementById("clearDataBtn")
  if (clearDataBtn) {
    clearDataBtn.addEventListener("click", () => {
      if (confirm("Are you sure? This will delete all data.")) {
        clearAllData()
      }
    })
    console.log('✅ Clear data button attached')
  }

  const generateSampleDataBtn = document.getElementById("generateSampleDataBtn")
  if (generateSampleDataBtn) {
    generateSampleDataBtn.addEventListener("click", generateSampleData)
    console.log('✅ Generate sample data button attached')
  }

  // Notification bell
  const notificationBtn = document.getElementById("notificationBtn")
  if (notificationBtn) {
    notificationBtn.addEventListener("click", () => navigateToPage("notifications"))
    console.log('✅ Notification bell attached')
  }

  // Modal close on overlay click
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-overlay")) {
      closeAllModals()
    }
  })

  // Escape key to close modals
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllModals()
    }
  })

  console.log('✅ All event listeners initialized successfully')
}

// ============================================================================
// MODAL MANAGEMENT FUNCTIONS (Make sure these exist too)
// ============================================================================

function openModal(modalId) {
  console.log('📂 Opening modal:', modalId)
  const modal = document.getElementById(modalId)
  if (modal) {
    // Add show class
    modal.classList.add("show")
    
    // Force display (backup)
    modal.style.display = "flex"
    modal.style.opacity = "1"
    modal.style.visibility = "visible"
    
    // Prevent body scroll
    document.body.style.overflow = "hidden"
    document.body.classList.add('modal-open')
    
    console.log('✅ Modal opened:', modalId)
    console.log('   Display:', modal.style.display)
    console.log('   Classes:', modal.className)
  } else {
    console.error('❌ Modal not found:', modalId)
  }
}

function closeModal(modalId) {
  console.log('📁 Closing modal:', modalId)
  const modal = document.getElementById(modalId)
  if (modal) {
    // Remove show class
    modal.classList.remove("show")
    
    // Force hide (backup)
    modal.style.display = "none"
    modal.style.opacity = "0"
    modal.style.visibility = "hidden"
    
    // Restore body scroll
    document.body.style.overflow = "auto"
    document.body.classList.remove('modal-open')
    
    console.log('✅ Modal closed:', modalId)
  }
}

function closeAllModals() {
  console.log('📁 Closing all modals')
  document.querySelectorAll(".modal-overlay").forEach((modal) => {
    modal.classList.remove("show")
    modal.style.display = "none"
  })
  document.body.style.overflow = "auto"
  console.log('✅ All modals closed')
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar")
  sidebarCollapsed = !sidebarCollapsed
  sidebar.classList.toggle("collapsed", sidebarCollapsed)
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById("sidebar")
  sidebar.classList.toggle("mobile-open")
}

function toggleUserMenu() {
  const userDropdown = document.getElementById("userDropdown")
  userDropdown.classList.toggle("show")
}

// ============================================================================
// DASHBOARD
// ============================================================================

function updateDashboard() {
  const totalBalance = students.reduce((sum, s) => sum + parseFloat(s.balance || 0), 0)
  const pendingCount = transactions.filter((t) => t.status === "Pending").length

  document.getElementById("dashboardTotalUsers").textContent = students.length
  document.getElementById("dashboardTotalBalance").textContent = "$" + totalBalance.toFixed(2)
  document.getElementById("dashboardPendingTx").textContent = pendingCount
  document.getElementById("dashboardTotalTx").textContent = transactions.length

  renderRecentActivity()
  updateNotificationBadge()
}

function renderRecentActivity() {
  const recentList = document.getElementById("recentActivityList")
  if (!recentList) return

  const recent = [...transactions].reverse().slice(0, 5)

  if (recent.length === 0) {
    recentList.innerHTML = '<p style="color: var(--muted-foreground);">No transactions yet</p>'
    return
  }

  recentList.innerHTML = recent
    .map((tx) => {
      const student = students.find((s) => s.id === tx.studentId)
      const studentName = student ? student.name : "Unknown"
      const txType = tx.type || "Unknown"
      const txStatus = tx.status || "Unknown"
      const txAmount = parseFloat(tx.amount || 0).toFixed(2)
      const isCredit = txType === "Credit"

      return `
            <div style="padding: 0.75rem; background-color: var(--muted); border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <p style="font-weight: 500;">${studentName}</p>
                    <p style="font-size: 0.875rem; color: var(--muted-foreground);">${txType} - ${formatDate(tx.date)}</p>
                </div>
                <div style="text-align: right;">
                    <p style="font-weight: 600; color: ${isCredit ? "#10b981" : "#ef4444"};">
                        ${isCredit ? "+" : "-"}$${txAmount}
                    </p>
                    <span class="badge ${getStatusBadgeClass(txStatus)}">${txStatus}</span>
                </div>
            </div>
        `
    })
    .join("")
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================

function updateUserStats() {
  const activeStudents = students.filter((s) => s.status === "Active").length
  const totalBalance = students.reduce((sum, s) => sum + parseFloat(s.balance || 0), 0)

  document.getElementById("totalUsers").textContent = students.length
  document.getElementById("activeUsers").textContent = activeStudents
  document.getElementById("totalBalance").textContent = "$" + totalBalance.toFixed(2)
}

function filterStudents() {
  const searchInput = document.getElementById("userSearch")
  const statusSelect = document.getElementById("statusFilter")

  if (!searchInput || !statusSelect) return

  const searchTerm = searchInput.value.toLowerCase()
  const statusFilter = statusSelect.value

  filteredStudents = students.filter((student) => {
    const studentName = student.name || ""
    const studentEmail = student.email || ""
    const studentAccNum = student.accountNumber || ""
    const studentId = student.id || ""

    const matchesSearch =
      studentName.toLowerCase().includes(searchTerm) ||
      studentEmail.toLowerCase().includes(searchTerm) ||
      studentAccNum.toLowerCase().includes(searchTerm) ||
      studentId.toLowerCase().includes(searchTerm)

    const matchesStatus = statusFilter === "all" || student.status === statusFilter

    return matchesSearch && matchesStatus
  })

  userCurrentPage = 1
  filterAndRenderStudents()
}

function filterAndRenderStudents() {
  renderStudentsTable()
  updateUserPagination()
}

function renderStudentsTable() {
  const tbody = document.getElementById("usersTableBody")
  if (!tbody) return

  const startIndex = (userCurrentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedStudents = filteredStudents.slice(startIndex, endIndex)

  tbody.innerHTML = ""

  if (paginatedStudents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No students found</td></tr>'
    return
  }

  paginatedStudents.forEach((student) => {
    const row = document.createElement("tr")
    const studentName = student.name || "Unknown"
    const initials = studentName
      .split(" ")
      .map((n) => n[0] || "")
      .join("")
      .toUpperCase()

    // Get RBAC data
    const role = student.role || 'user'
    const roleDisplay = role.replace('_', ' ')
    const roleBadgeClass = `role-${role}`
    const isActive = student.is_active !== false
    const onlineStatus = getOnlineStatus(student.last_seen)
    const onlineClass = onlineStatus === 'Online' ? 'online' : onlineStatus === 'Offline' ? 'offline' : 'never'
    const canEdit = currentAdminRole === 'master_admin' || role !== 'master_admin'

    row.innerHTML = `
            <td>
                <div class="user-cell">
                    <div class="user-avatar-table">${initials}</div>
                    <div class="user-info-table">
                        <div class="user-name">${studentName}</div>
                        <div class="user-id">${student.id || "N/A"}</div>
                    </div>
                </div>
            </td>
            <td>${student.email || "N/A"}</td>
            <td>
                <span class="role-badge ${roleBadgeClass}">${roleDisplay}</span>
            </td>
            <td>
                <label class="toggle-switch ${!canEdit ? 'disabled' : ''}">
                    <input type="checkbox" ${isActive ? 'checked' : ''} ${!canEdit ? 'disabled' : ''}
                        onchange="toggleUserStatus('${student.userId}', this.checked)">
                    <span class="toggle-slider"></span>
                </label>
            </td>
            <td>
                <span class="online-indicator ${onlineClass}">
                    <span class="status-dot"></span>
                    ${onlineStatus}
                </span>
            </td>
            <td>
                <span style="font-family: monospace; font-size: 0.875rem;">${student.accountNumber || "N/A"}</span>
            </td>
            <td>
                <span style="font-weight: 600;">$${parseFloat(student.balance || 0).toFixed(2)}</span>
            </td>
            <td>
                <div style="display: flex; gap: 0.25rem;">
                    ${canEdit ? `
                    <button class="action-btn" onclick="editStudent('${student.id}')" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    ${role !== 'master_admin' ? `
                    <button class="action-btn" onclick="deleteStudent('${student.id}')" title="Delete" style="color: var(--destructive);">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"/>
                            <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                        </svg>
                    </button>
                    ` : ''}
                    <button class="action-btn" onclick="openSendMessageModal('${student.id}', '${studentName.replace(/'/g, "\\'")})')" title="Message">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                    </button>
                    ` : `<span style="color: var(--muted-foreground); font-size: 0.875rem;">Protected</span>`}
                </div>
            </td>
        `
    tbody.appendChild(row)
  })
}

function updateUserPagination() {
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage)
  const startIndex = (userCurrentPage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + itemsPerPage, filteredStudents.length)

  const paginationInfo = document.getElementById("paginationInfo")
  const pageInfo = document.getElementById("pageInfo")
  const prevPage = document.getElementById("prevPage")
  const nextPage = document.getElementById("nextPage")

  if (paginationInfo) {
    paginationInfo.textContent =
      `Showing ${startIndex + 1} to ${endIndex} of ${filteredStudents.length} students`
  }

  if (pageInfo) {
    pageInfo.textContent = `Page ${userCurrentPage} of ${totalPages || 1}`
  }

  if (prevPage) {
    prevPage.disabled = userCurrentPage === 1
  }

  if (nextPage) {
    nextPage.disabled = userCurrentPage === totalPages || totalPages === 0
  }
}

function changeUserPage(direction) {
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage)
  const newPage = userCurrentPage + direction

  if (newPage >= 1 && newPage <= totalPages) {
    userCurrentPage = newPage
    filterAndRenderStudents()
  }
}

// ============================================================================
// STUDENT CRUD OPERATIONS
// ============================================================================

async function createUser() {
  const form = document.getElementById("createUserForm")
  const formData = new FormData(form)

  try {
    const email = formData.get("email")
    const name = formData.get("name")
    const password = formData.get("password")
    const accountNumber = formData.get("accountNumber")
    const balance = parseFloat(formData.get("balance")) || 0

    // ✅ Create auth user
    const { data: authData, error: authError } = await window.supabaseClient.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          full_name: name
        }
      }
    })

    if (authError) throw authError
    if (!authData.user) throw new Error('Failed to create auth user')

    const userId = authData.user.id

    // ✅ Get role from dropdown (master admin only)
    const roleSelect = document.getElementById('userRole')
    let role = 'user' // Default
    if (roleSelect && currentAdminRole === 'master_admin') {
      role = roleSelect.value
      console.log('✅ Master admin creating user with role:', role)
    } else {
      console.log('ℹ️ Regular admin - forcing role to user')
    }

    // ✅ Create in 'users' table with selected role
    const { data: userData, error: userError } = await window.supabaseClient
      .from('users')
      .insert({
        id: userId,
        email: email,
        name: name,
        password: password,
        role: role,
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (userError) throw userError

    // ✅ Create account record
    const { data: accountData, error: accountError } = await window.supabaseClient
      .from('accounts')
      .insert({
        user_id: userId,
        account_number: accountNumber,
        balance: balance,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (accountError) throw accountError

    // Reload data
    await loadAllData()
    updateUserStats()
    filterStudents()
    addNotification(`New user "${name}" created successfully.`)
    closeModal("createUserModal")
    form.reset()

  } catch (error) {
    console.error('Failed to create student:', error)
    addNotification(`Error creating user: ${error.message}`)
  }
}

async function editStudent(studentId) {
  const student = students.find((s) => s.id === studentId)
  if (!student) return

  currentEditingUser = student

  document.getElementById("editUserName").value = student.name
  document.getElementById("editUserEmail").value = student.email
  document.getElementById("editUserAccountNumber").value = student.accountNumber
  document.getElementById("editUserBalance").value = student.balance
  document.getElementById("editUserStatus").value = student.status

  openModal("editUserModal")
}

async function updateStudent() {
  if (!currentEditingUser) return

  try {
    const newName = document.getElementById("editUserName").value
    const newBalance = parseFloat(document.getElementById("editUserBalance").value)
    const newStatus = document.getElementById("editUserStatus").value

    console.log('📝 Updating user:', currentEditingUser)
    console.log('   User ID:', currentEditingUser.userId)
    console.log('   Account ID:', currentEditingUser.accountId)

    if (!currentEditingUser.userId) {
      throw new Error('User ID is missing. Please reload the page and try again.')
    }

    if (!currentEditingUser.accountId) {
      throw new Error('Account ID is missing. Please reload the page and try again.')
    }

    // Update in 'users' table
    const { error: userError } = await window.supabaseClient
      .from('users')
      .update({
        name: newName,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentEditingUser.userId)

    if (userError) throw userError

    // Update account balance
    const { error: accountError } = await window.supabaseClient
      .from('accounts')
      .update({
        balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentEditingUser.accountId)

    if (accountError) throw accountError

    await loadAllData()
    updateUserStats()
    filterStudents()
    addNotification(`User "${newName}" updated successfully.`)
    closeModal("editUserModal")
    currentEditingUser = null

  } catch (error) {
    console.error('Failed to update student:', error)
    addNotification(`Error updating user: ${error.message}`)
  }
}

async function updateUser() {
  return await updateStudent()
}

async function quickCredit() {
  if (!currentEditingUser) return

  const amount = parseFloat(document.getElementById("adjustAmount").value)
  if (isNaN(amount) || amount <= 0) {
    alert("Please enter a valid amount")
    return
  }

  try {
    const newBalance = currentEditingUser.balance + amount

    const { error } = await window.supabaseClient
      .from('accounts')
      .update({ balance: newBalance })
      .eq('id', currentEditingUser.accountId)

    if (error) throw error

    currentEditingUser.balance = newBalance
    document.getElementById("editUserBalance").value = newBalance

    addNotification(`Credited $${amount.toFixed(2)} to ${currentEditingUser.name}`)
    document.getElementById("adjustAmount").value = ""

  } catch (error) {
    console.error('Failed to credit:', error)
    addNotification(`Error crediting account: ${error.message}`)
  }
}

async function quickDebit() {
  if (!currentEditingUser) return

  const amount = parseFloat(document.getElementById("adjustAmount").value)
  if (isNaN(amount) || amount <= 0) {
    alert("Please enter a valid amount")
    return
  }

  if (currentEditingUser.balance < amount) {
    alert("Insufficient balance")
    return
  }

  try {
    const newBalance = currentEditingUser.balance - amount

    const { error } = await window.supabaseClient
      .from('accounts')
      .update({ balance: newBalance })
      .eq('id', currentEditingUser.accountId)

    if (error) throw error

    currentEditingUser.balance = newBalance
    document.getElementById("editUserBalance").value = newBalance

    addNotification(`Debited $${amount.toFixed(2)} from ${currentEditingUser.name}`)
    document.getElementById("adjustAmount").value = ""

  } catch (error) {
    console.error('Failed to debit:', error)
    addNotification(`Error debiting account: ${error.message}`)
  }
}

async function toggleStudentStatus(studentId) {
  const studentIndex = students.findIndex((s) => s.id === studentId)
  if (studentIndex !== -1) {
    const newStatus = students[studentIndex].status === "Active" ? "Inactive" : "Active"
    students[studentIndex].status = newStatus
    updateUserStats()
    filterStudents()
    addNotification(`User status changed to ${newStatus}`)
  }
}

async function deleteStudent(studentId) {
  const student = students.find((s) => s.id === studentId)
  if (!student) return

  if (confirm(`Are you sure you want to delete ${student.name}? This action cannot be undone.`)) {
    try {
      const { error } = await window.supabaseClient
        .from('users')
        .delete()
        .eq('id', student.userId)

      if (error) throw error

      await loadAllData()
      updateUserStats()
      filterStudents()
      addNotification(`User "${student.name}" deleted successfully.`)

    } catch (error) {
      console.error('Failed to delete student:', error)
      addNotification(`Error deleting user: ${error.message}`)
    }
  }
}

// ============================================================================
// TRANSACTION MANAGEMENT
// ============================================================================

function updateTransactionStats() {
  const totalCount = transactions.length
  const pendingCount = transactions.filter((t) => t.status === "Pending").length
  const approvedCount = transactions.filter((t) => t.status === "Approved").length
  const rejectedCount = transactions.filter((t) => t.status === "Rejected").length

  document.getElementById("txTotalCount").textContent = totalCount
  document.getElementById("txPendingCount").textContent = pendingCount
  document.getElementById("txApprovedCount").textContent = approvedCount
  document.getElementById("txRejectedCount").textContent = rejectedCount
}

function filterTransactions() {
  const searchInput = document.getElementById("transactionSearch")
  const statusSelect = document.getElementById("transactionStatusFilter")
  const typeSelect = document.getElementById("transactionTypeFilter")

  if (!searchInput || !statusSelect || !typeSelect) return

  const searchTerm = searchInput.value.toLowerCase()
  const statusFilter = statusSelect.value
  const typeFilter = typeSelect.value

  filteredTransactions = transactions.filter((tx) => {
    const student = students.find((s) => s.id === tx.studentId)
    const studentName = student ? student.name : ""
    const txId = tx.id || ""
    const txAmount = tx.amount ? tx.amount.toString() : ""

    const matchesSearch =
      txId.toLowerCase().includes(searchTerm) ||
      studentName.toLowerCase().includes(searchTerm) ||
      txAmount.includes(searchTerm)

    const matchesStatus = statusFilter === "all" || tx.status === statusFilter
    const matchesType = typeFilter === "all" || tx.type === typeFilter

    return matchesSearch && matchesStatus && matchesType
  })

  txCurrentPage = 1
  filterAndRenderTransactions()
}

function filterAndRenderTransactions() {
  renderTransactionsTable()
  updateTransactionPagination()
}

function renderTransactionsTable() {
  const tbody = document.getElementById("transactionsTableBody")
  if (!tbody) return

  const startIndex = (txCurrentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedTx = filteredTransactions.slice(startIndex, endIndex)

  tbody.innerHTML = ""

  if (paginatedTx.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No transactions found</td></tr>'
    return
  }

  paginatedTx.forEach((tx) => {
    const student = students.find((s) => s.id === tx.studentId)
    const studentName = student ? student.name : "Unknown"
    const studentEmail = student ? student.email : "N/A"
    const txType = tx.type || "Unknown"
    const txStatus = tx.status || "Unknown"
    const txAmount = parseFloat(tx.amount || 0).toFixed(2)
    const isCredit = txType === "Credit"
    const row = document.createElement("tr")

    row.innerHTML = `
            <td style="font-family: monospace; font-size: 0.875rem;">${tx.id || "N/A"}</td>
            <td>
                <div class="user-info-table">
                    <div class="user-name">${studentName}</div>
                    <div class="user-email">${studentEmail}</div>
                </div>
            </td>
            <td>
                <span class="badge ${isCredit ? "badge-default" : "badge-secondary"}">${txType}</span>
            </td>
            <td style="font-weight: 600; color: ${isCredit ? "#10b981" : "#ef4444"};">
                ${isCredit ? "+" : "-"}$${txAmount}
            </td>
            <td>
                <span class="badge ${getStatusBadgeClass(txStatus)}">${txStatus}</span>
            </td>
            <td style="font-size: 0.875rem;">${formatDate(tx.date)}</td>
            <td style="font-family: monospace; font-size: 0.75rem; color: var(--muted-foreground);">${tx.otp || "N/A"}</td>
            <td>
                <button class="action-btn" onclick="viewTransactionDetails('${tx.id}')" title="View Details">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                </button>
            </td>
        `
    tbody.appendChild(row)
  })
}

function updateTransactionPagination() {
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)
  const startIndex = (txCurrentPage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + itemsPerPage, filteredTransactions.length)

  const txPaginationInfo = document.getElementById("txPaginationInfo")
  const txPageInfo = document.getElementById("txPageInfo")
  const txPrevPage = document.getElementById("txPrevPage")
  const txNextPage = document.getElementById("txNextPage")

  if (txPaginationInfo) {
    txPaginationInfo.textContent =
      `Showing ${startIndex + 1} to ${endIndex} of ${filteredTransactions.length} transactions`
  }

  if (txPageInfo) {
    txPageInfo.textContent = `Page ${txCurrentPage} of ${totalPages || 1}`
  }

  if (txPrevPage) {
    txPrevPage.disabled = txCurrentPage === 1
  }

  if (txNextPage) {
    txNextPage.disabled = txCurrentPage === totalPages || totalPages === 0
  }
}

function changeTransactionPage(direction) {
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)
  const newPage = txCurrentPage + direction

  if (newPage >= 1 && newPage <= totalPages) {
    txCurrentPage = newPage
    filterAndRenderTransactions()
  }
}

function viewTransactionDetails(txId) {
  const tx = transactions.find((t) => t.id === txId)
  if (!tx) return

  const student = students.find((s) => s.id === tx.studentId)
  alert(
    `Transaction Details:\n\n` +
    `ID: ${tx.id}\n` +
    `Student: ${student?.name || "Unknown"}\n` +
    `Type: ${tx.type}\n` +
    `Amount: $${tx.amount}\n` +
    `Status: ${tx.status}\n` +
    `OTP: ${tx.otp}\n` +
    `Date: ${formatDate(tx.date)}`
  )
}

// ============================================================================
// APPROVAL SYSTEM
// ============================================================================

function updateApprovalsPage() {
  const approvalPendingCount = transactions.filter((t) => t.status === "Pending").length
  const approvalTodayCount = transactions.filter((t) => {
    const txDate = new Date(t.date)
    const today = new Date()
    return t.status === "Approved" && txDate.toDateString() === today.toDateString()
  }).length

  document.getElementById("approvalPendingCount").textContent = approvalPendingCount
  document.getElementById("approvalTodayCount").textContent = approvalTodayCount

  renderPendingApprovals()
}

function renderPendingApprovals() {
  const tbody = document.getElementById("approvalsTableBody")
  if (!tbody) return

  const pendingTx = transactions.filter((t) => t.status === "Pending")

  tbody.innerHTML = ""

  if (pendingTx.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No pending approvals</td></tr>'
    return
  }

  pendingTx.forEach((tx) => {
    const student = students.find((s) => s.id === tx.studentId)
    const studentName = student ? student.name : "Unknown"
    const studentEmail = student ? student.email : "N/A"
    const txType = tx.type || "Unknown"
    const txAmount = parseFloat(tx.amount || 0).toFixed(2)
    const isCredit = txType === "Credit"
    const row = document.createElement("tr")

    row.innerHTML = `
            <td style="font-family: monospace; font-size: 0.875rem;">${tx.transactionId || "N/A"}</td>
            <td>
                <div class="user-info-table">
                    <div class="user-name">${studentName}</div>
                    <div class="user-email">${studentEmail}</div>
                </div>
            </td>
            <td>
                <span class="badge ${isCredit ? "badge-default" : "badge-secondary"}">${txType}</span>
            </td>
            <td style="font-weight: 600; color: ${isCredit ? "#10b981" : "#ef4444"};">
                ${isCredit ? "+" : "-"}$${txAmount}
            </td>
            <td style="font-family: monospace; font-size: 0.75rem; color: var(--muted-foreground);">${tx.otp || "N/A"}</td>
            <td style="font-size: 0.875rem;">${formatDate(tx.date)}</td>
            <td>
                <div style="display: flex; gap: 0.25rem;">
                    <button class="btn btn-outline btn-sm" onclick="openApprovalModal('${tx.transactionId}')">Review</button>
                </div>
            </td>
        `
    tbody.appendChild(row)
  })
}

function openApprovalModal(txId) {
  console.log('📋 openApprovalModal() called with txId:', txId)

  const tx = transactions.find((t) => t.transactionId === txId)

  if (!tx) {
    console.warn('⚠️ Transaction not found:', txId)
    return
  }

  console.log('✅ Transaction found:', tx)
  currentApprovingTransaction = tx

  const student = students.find((s) => s.id === tx.studentId)
  const studentName = student ? student.name : "Unknown"
  const studentEmail = student ? student.email : "N/A"
  const txType = tx.type || "Unknown"
  const txAmount = parseFloat(tx.amount || 0).toFixed(2)
  const isCredit = txType === "Credit"

  const content = document.getElementById("approveTransactionContent")
  if (!content) {
    console.error('❌ approveTransactionContent element not found')
    return
  }

  content.innerHTML = `
        <div>
            <div style="margin-bottom: 1.5rem;">
                <p style="font-size: 0.875rem; color: var(--muted-foreground); margin-bottom: 0.25rem;">User</p>
                <p style="font-weight: 600; font-size: 1.125rem;">${studentName}</p>
                <p style="font-size: 0.875rem; color: var(--muted-foreground);">${studentEmail}</p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                <div>
                    <p style="font-size: 0.875rem; color: var(--muted-foreground); margin-bottom: 0.25rem;">Transaction ID</p>
                    <p style="font-family: monospace; font-weight: 600;">${tx.transactionId || "N/A"}</p>
                </div>
                <div>
                    <p style="font-size: 0.875rem; color: var(--muted-foreground); margin-bottom: 0.25rem;">Type</p>
                    <span class="badge ${isCredit ? "badge-default" : "badge-secondary"}">${txType}</span>
                </div>
                <div>
                    <p style="font-size: 0.875rem; color: var(--muted-foreground); margin-bottom: 0.25rem;">Amount</p>
                    <p style="font-weight: 600; color: ${isCredit ? "#10b981" : "#ef4444"}; font-size: 1.125rem;">
                        ${isCredit ? "+" : "-"}$${txAmount}
                    </p>
                </div>
                <div>
                    <p style="font-size: 0.875rem; color: var(--muted-foreground); margin-bottom: 0.25rem;">Date</p>
                    <p style="font-weight: 500;">${formatDate(tx.date)}</p>
                </div>
            </div>

            <div style="background-color: var(--muted); padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
                <p style="font-size: 0.875rem; color: var(--muted-foreground); margin-bottom: 0.25rem;">Description</p>
                <p style="font-weight: 500;">${tx.description || 'No description'}</p>
            </div>

            <div style="background-color: var(--muted); padding: 1rem; border-radius: 6px;">
                <p style="font-size: 0.875rem; color: var(--muted-foreground); margin-bottom: 0.25rem;">OTP Code</p>
                <p style="font-family: monospace; font-weight: 600; font-size: 1.125rem;">${tx.otp || 'N/A'}</p>
            </div>
        </div>
    `

  openModal("approveTransactionModal")
}

async function approveTransaction() {
  console.log('🟢 approveTransaction() called')

  if (!currentApprovingTransaction) {
    console.warn('⚠️ No transaction selected for approval')
    addNotification('❌ No transaction selected')
    return
  }

  const approveBtn = document.getElementById("approveTransactionBtn")
  const rejectBtn = document.getElementById("rejectTransactionBtn")
  if (approveBtn) approveBtn.disabled = true
  if (rejectBtn) rejectBtn.disabled = true

  try {
    const txId = currentApprovingTransaction.transactionId
    console.log(`⏳ Approving transaction ${txId}...`)

    const { data: updateData, error } = await window.supabaseClient
      .from('transactions')
      .update({
        status: 'SUCCESSFUL',
        updated_at: new Date().toISOString()
      })
      .eq('id', txId)
      .select()

    if (error) {
      console.error('❌ Database error:', error)
      throw error
    }

    console.log('✅ Transaction approved in database')

    await loadAllData()
    updateApprovalsPage()
    updateTransactionStats()
    updateDashboard()

    addNotification(`✅ Transaction ${txId} approved successfully`)
    closeModal("approveTransactionModal")
    currentApprovingTransaction = null

  } catch (error) {
    console.error('❌ Failed to approve transaction:', error)
    addNotification(`❌ Error approving transaction: ${error.message}`)

    if (approveBtn) approveBtn.disabled = false
    if (rejectBtn) rejectBtn.disabled = false
  }
}

async function rejectTransaction() {
  console.log('🔴 rejectTransaction() called')

  if (!currentApprovingTransaction) {
    console.warn('⚠️ No transaction selected for rejection')
    addNotification('❌ No transaction selected')
    return
  }

  const approveBtn = document.getElementById("approveTransactionBtn")
  const rejectBtn = document.getElementById("rejectTransactionBtn")
  if (approveBtn) approveBtn.disabled = true
  if (rejectBtn) rejectBtn.disabled = true

  try {
    const tx = currentApprovingTransaction
    const txId = tx.transactionId

    console.log(`⏳ Rejecting transaction ${txId}...`)

    const student = students.find(s => s.id === tx.studentId)

    // If it's a debit transaction, refund the amount
    if (tx.type === 'Debit' && student && student.accountId) {
      const refundAmount = parseFloat(tx.amount)
      const currentBalance = parseFloat(student.balance)
      const newBalance = currentBalance + refundAmount

      console.log(`💰 Refunding ${refundAmount} to student ${student.id}`)

      const { data: balanceData, error: balanceError } = await window.supabaseClient
        .from('accounts')
        .update({
          balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', student.accountId)
        .select()

      if (balanceError) {
        console.error('❌ Balance update error:', balanceError)
        throw balanceError
      }

      console.log('✅ Refund processed successfully')
    }

    const { data: txData, error: txError } = await window.supabaseClient
      .from('transactions')
      .update({
        status: 'REJECTED',
        updated_at: new Date().toISOString()
      })
      .eq('id', txId)
      .select()

    if (txError) {
      console.error('❌ Transaction update error:', txError)
      throw txError
    }

    console.log('✅ Transaction rejected in database')

    await loadAllData()
    updateApprovalsPage()
    updateTransactionStats()
    updateDashboard()

    const refundMsg = tx.type === 'Debit' ? ' Amount refunded to user.' : ''
    addNotification(`✅ Transaction ${txId} rejected.${refundMsg}`)
    closeModal("approveTransactionModal")
    currentApprovingTransaction = null

  } catch (error) {
    console.error('❌ Failed to reject transaction:', error)
    addNotification(`❌ Error rejecting transaction: ${error.message}`)

    if (approveBtn) approveBtn.disabled = false
    if (rejectBtn) rejectBtn.disabled = false
  }
}

// ============================================================================
// SIMULATION SYSTEM
// ============================================================================

function updateSimulateStats() {
  const simulatedCount = transactions.filter(t => t.status === 'Pending').length
  document.getElementById("simulatedCount").textContent = simulatedCount
}

function populateStudentSelect() {
  const select = document.getElementById("simStudentSelect")
  select.innerHTML = '<option value="">-- Select User --</option>'

  students.forEach((student) => {
    const option = document.createElement("option")
    option.value = student.id
    option.textContent = `${student.name} (${student.accountNumber})`
    select.appendChild(option)
  })
}

function generateSimulationOTP() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  document.getElementById("simOTP").value = otp
  addNotification(`OTP generated: ${otp}`)
}

async function submitSimulatedTransaction(e) {
  e.preventDefault()

  const studentId = document.getElementById("simStudentSelect").value
  const type = document.getElementById("simTransactionType").value
  const amount = parseFloat(document.getElementById("simAmount").value)
  const otp = document.getElementById("simOTP").value

  if (!studentId || !amount || !otp) {
    alert("Please fill in all fields and generate an OTP")
    return
  }

  const student = students.find((s) => s.id === studentId)
  if (!student) return

  if (type === "Debit") {
    if (student.balance < amount) {
      alert("Insufficient balance for this transaction")
      return
    }
  }

  try {
    const { error } = await window.supabaseClient
      .from('transactions')
      .insert({
        account_id: student.accountId,
        type: type === 'Debit' ? 'OUTGOING' : 'INCOMING',
        amount: amount,
        recipient_name: 'Bank Transfer',
        recipient_bank: 'Internal',
        recipient_account: 'TXN-' + Date.now(),
        description: 'Account Credit',
        status: 'PENDING',
        created_at: new Date().toISOString()
      })

    if (error) throw error

    if (type === "Debit") {
      const newBalance = student.balance - amount
      const { error: balanceError } = await window.supabaseClient
        .from('accounts')
        .update({ balance: newBalance })
        .eq('id', student.accountId)

      if (balanceError) throw balanceError
    }

    await loadAllData()
    updateDashboard()
    updateTransactionStats()
    updateApprovalsPage()
    updateSimulateStats()

    addNotification(`Transaction simulated: ${type} $${amount.toFixed(2)} for ${student.name}. Status: Pending`)

    document.getElementById("simulateTransactionForm").reset()
    document.getElementById("simStudentSelect").focus()

  } catch (error) {
    console.error('Failed to submit simulated transaction:', error)
    addNotification(`Error: ${error.message}`)
  }
}

// ============================================================================
// NOTIFICATIONS SYSTEM
// ============================================================================

function addNotification(message) {
  const notification = {
    id: "NOT" + Date.now(),
    message: message,
    timestamp: new Date().toISOString(),
    type: "info",
  }

  notifications.push(notification)
  updateNotificationBadge()
}

function updateNotificationBadge() {
  const badge = document.getElementById("notificationBadge")
  const unreadCount = notifications.length

  if (unreadCount > 0) {
    badge.style.display = "block"
    badge.textContent = unreadCount > 99 ? "99+" : unreadCount
  } else {
    badge.style.display = "none"
  }
}

function renderNotifications() {
  const notificationsList = document.getElementById("notificationsList")

  if (notifications.length === 0) {
    notificationsList.innerHTML =
      '<p style="color: var(--muted-foreground); text-align: center; padding: 2rem;">No notifications</p>'
    return
  }

  notificationsList.innerHTML = [...notifications]
    .reverse()
    .map(
      (notif) => `
        <div style="padding: 1rem; background-color: var(--muted); border-radius: 6px; border-left: 3px solid var(--primary); display: flex; justify-content: space-between; align-items: center;">
            <div>
                <p style="font-weight: 500;">${notif.message}</p>
                <p style="font-size: 0.875rem; color: var(--muted-foreground);">${formatDate(notif.timestamp)}</p>
            </div>
            <button class="action-btn" onclick="deleteNotification('${notif.id}')" title="Delete">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
    `,
    )
    .join("")
}

function deleteNotification(notifId) {
  notifications = notifications.filter((n) => n.id !== notifId)
  updateNotificationBadge()
  renderNotifications()
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function getStatusBadgeClass(status) {
  switch (status) {
    case "Approved":
      return "badge-default"
    case "Pending":
      return "badge-secondary"
    case "Rejected":
      return "badge-destructive"
    default:
      return "badge-outline"
  }
}

// ============================================================================
// MODAL MANAGEMENT
// ============================================================================

function openModal(modalId) {
  document.getElementById(modalId).classList.add("show")
  document.body.style.overflow = "hidden"

  if (modalId === 'createUserModal') {
    setTimeout(() => {
      const roleGroup = document.getElementById('roleSelectGroup')
      if (roleGroup) {
        if (currentAdminRole === 'master_admin') {
          roleGroup.style.display = 'block'
          console.log('✅ Role dropdown shown for master admin')
        } else {
          roleGroup.style.display = 'none'
        }
      }
    }, 50)
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId)
  if (modal) {
    modal.classList.remove("show")
    document.body.style.overflow = "auto"
  }
}

function closeAllModals() {
  document.querySelectorAll(".modal-overlay").forEach((modal) => {
    modal.classList.remove("show")
  })
  document.body.style.overflow = "auto"
}

// ============================================================================
// MESSAGE MANAGEMENT
// ============================================================================

let currentMessageRecipientId = null
let currentMessageRecipientName = null

function openSendMessageModal(userId, userName) {
  currentMessageRecipientId = userId
  currentMessageRecipientName = userName
  document.getElementById("messageRecipientName").textContent = userName
  document.getElementById("messageText").value = ""
  openModal("sendMessageModal")
}

async function submitMessage() {
  if (!currentMessageRecipientId) return

  const messageTextarea = document.getElementById("messageText")
  if (!messageTextarea) return

  const messageText = messageTextarea.value.trim()
  if (!messageText) {
    alert("Please enter a message")
    return
  }

  try {
    const { data: userData, error: userError } = await window.supabaseClient.auth.getUser()

    if (userError) throw userError
    if (!userData || !userData.user) {
      throw new Error("User not authenticated")
    }

    const { data, error } = await window.supabaseClient.from("messages").insert([
      {
        admin_id: userData.user.id,
        user_id: currentMessageRecipientId,
        message_text: messageText,
        created_at: new Date().toISOString(),
      },
    ])

    if (error) throw error

    addNotification(`Message sent to ${currentMessageRecipientName || "user"}`)
    closeModal("sendMessageModal")
    currentMessageRecipientId = null
    currentMessageRecipientName = null
  } catch (error) {
    console.error('Failed to send message:', error)
    addNotification(`Error sending message: ${error.message}`)
  }
}

// ============================================================================
// DATA MANAGEMENT FUNCTIONS
// ============================================================================

async function clearAllData() {
  try {
    console.log('🗑️ Clearing all data...')

    const { error: txError } = await window.supabaseClient
      .from('transactions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (txError) console.error('Error deleting transactions:', txError)

    const { error: accountError } = await window.supabaseClient
      .from('accounts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (accountError) console.error('Error deleting accounts:', accountError)

    const { error: userError } = await window.supabaseClient
      .from('users')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (userError) console.error('Error deleting users:', userError)

    students = []
    accounts = []
    transactions = []
    notifications = []

    await loadAllData()
    updateDashboard()

    addNotification('✅ All data cleared successfully')
    console.log('✅ Data cleared')

  } catch (error) {
    console.error('❌ Failed to clear data:', error)
    addNotification('❌ Error clearing data: ' + error.message)
  }
}

async function generateSampleData() {
  try {
    console.log('🎲 Generating sample data...')

    const sampleUsers = [
      { name: 'Alice Johnson', email: 'alice@example.com', password: 'password123', accountNumber: 'ACC-001', balance: 2500 },
      { name: 'Bob Smith', email: 'bob@example.com', password: 'password123', accountNumber: 'ACC-002', balance: 3750 },
      { name: 'Carol White', email: 'carol@example.com', password: 'password123', accountNumber: 'ACC-003', balance: 1200 }
    ]

    for (const user of sampleUsers) {
      const { data: authData, error: authError } = await window.supabaseClient.auth.signUp({
        email: user.email,
        password: user.password,
        options: {
          data: { full_name: user.name }
        }
      })

      if (authError) {
        console.warn('Auth error for', user.email, ':', authError.message)
        continue
      }

      const userId = authData.user.id

      await window.supabaseClient
        .from('users')
        .insert({
          id: userId,
          email: user.email,
          name: user.name,
          role: 'user',
          created_at: new Date().toISOString()
        })

      await window.supabaseClient
        .from('accounts')
        .insert({
          user_id: userId,
          account_number: user.accountNumber,
          balance: user.balance,
          created_at: new Date().toISOString()
        })

      console.log('✅ Created sample user:', user.name)
    }

    await loadAllData()
    updateDashboard()
    updateUserStats()

    addNotification('✅ Sample data generated successfully')
    console.log('✅ Sample data generation complete')

  } catch (error) {
    console.error('❌ Failed to generate sample data:', error)
    addNotification('❌ Error generating sample data: ' + error.message)
  }
}

// ============================================================================
// RBAC HELPER FUNCTIONS
// ============================================================================

function getOnlineStatus(lastSeen) {
  if (!lastSeen) return 'Never'

  const lastSeenDate = new Date(lastSeen)
  const now = new Date()
  const diffMinutes = (now - lastSeenDate) / (1000 * 60)

  if (diffMinutes <= 5) return 'Online'
  return 'Offline'
}

async function toggleUserStatus(userId, isActive) {
  try {
    const { error } = await window.supabaseClient
      .from('users')
      .update({ is_active: isActive })
      .eq('id', userId)

    if (error) throw error

    console.log('✅ User status updated')
    await loadAllData()
    filterAndRenderStudents()
  } catch (error) {
    console.error('Error toggling status:', error)
    alert(error.message || 'Failed to update status')
    await loadAllData()
    filterAndRenderStudents()
  }
}

function showRoleDropdownIfMasterAdmin() {
  const roleGroup = document.getElementById('roleSelectGroup')
  if (roleGroup) {
    if (currentAdminRole === 'master_admin') {
      roleGroup.style.display = 'block'
    } else {
      roleGroup.style.display = 'none'
    }
  }
}

setInterval(async () => {
  if (window.apiClient && currentAdminSession) {
    await window.apiClient.updateLastSeen(currentAdminSession.userId)
  }
}, 2 * 60 * 1000)

setTimeout(() => {
  if (window.apiClient && currentAdminSession) {
    window.apiClient.updateLastSeen(currentAdminSession.userId)
  }
}, 2000)

// ============================================================================
// PROFILE PAGE FUNCTIONS
// ============================================================================

async function loadProfilePage() {
  console.log('📄 Loading profile page...')

  let container = document.getElementById('profile-content-container')
  if (!container) {
    container = document.getElementById('profilePage')
  }

  if (!container) {
    console.error('❌ Profile container not found!')
    return
  }

  try {
    container.innerHTML = `
            <div style="text-align: center; padding: 3rem;">
                <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid var(--primary); border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <p style="margin-top: 1rem;">Loading profile...</p>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `

    const sessionStr = localStorage.getItem('admin_session')
    if (!sessionStr) {
      throw new Error('Not logged in')
    }

    const adminSession = JSON.parse(sessionStr)
    console.log('👤 Admin session:', adminSession)

    const { data: profile, error } = await window.supabaseClient
      .from('users')
      .select('id, email, name, role, is_active, last_seen, created_at')
      .eq('id', adminSession.userId)
      .single()

    if (error) {
      console.error('❌ Database error:', error)
      throw error
    }

    console.log('✅ Profile loaded:', profile)

    const onlineStatus = getOnlineStatus(profile.last_seen)
    const initials = (profile.name || profile.email)
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)

    container.innerHTML = `
            <div style="background: var(--card); border-radius: 8px; padding: 2rem; max-width: 800px; margin: 2rem auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="display: flex; align-items: center; gap: 2rem; margin-bottom: 2rem; padding-bottom: 2rem; border-bottom: 1px solid var(--border);">
                    <div style="width: 100px; height: 100px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #8b5cf6); display: flex; align-items: center; justify-content: center; color: white; font-size: 2.5rem; font-weight: bold; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
                        ${initials}
                    </div>
                    <div style="flex: 1;">
                        <h2 style="margin: 0 0 0.5rem 0; font-size: 1.75rem; color: var(--foreground);">
                            ${profile.name || 'No Name Set'}
                        </h2>
                        <p style="color: var(--muted-foreground); margin: 0 0 0.75rem 0; font-size: 1rem;">
                            ${profile.email}
                        </p>
                        <span style="display: inline-block; padding: 0.35rem 1rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; text-transform: capitalize; background: ${profile.role === 'master_admin' ? '#fef3c7' : profile.role === 'admin' ? '#dbeafe' : '#f3f4f6'}; color: ${profile.role === 'master_admin' ? '#92400e' : profile.role === 'admin' ? '#1e40af' : '#374151'}; border: 1px solid ${profile.role === 'master_admin' ? '#fbbf24' : profile.role === 'admin' ? '#60a5fa' : '#d1d5db'};">
                            ${(profile.role || 'user').replace('_', ' ')}
                        </span>
                    </div>
                </div>
                
                <div style="display: grid; gap: 0;">
                    <div style="display: grid; grid-template-columns: 200px 1fr; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid var(--border); align-items: center;">
                        <label style="font-weight: 600; color: var(--foreground);">Account Status:</label>
                        <span style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; background: ${profile.is_active ? '#dcfce7' : '#fee2e2'}; color: ${profile.is_active ? '#166534' : '#991b1b'};">
                            ${profile.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 200px 1fr; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid var(--border); align-items: center;">
                        <label style="font-weight: 600; color: var(--foreground);">Online Status:</label>
                        <span style="display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; color: ${onlineStatus === 'Online' ? '#10b981' : '#6b7280'}; font-weight: 500;">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${onlineStatus === 'Online' ? '#10b981' : '#6b7280'}; ${onlineStatus === 'Online' ? 'animation: pulse 2s infinite;' : ''}"></span>
                            ${onlineStatus}
                        </span>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 200px 1fr; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid var(--border); align-items: center;">
                        <label style="font-weight: 600; color: var(--foreground);">Last Seen:</label>
                        <span style="color: var(--muted-foreground); font-size: 0.875rem;">
                            ${profile.last_seen ? formatDate(profile.last_seen) : 'Never logged in'}
                        </span>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 200px 1fr; gap: 1rem; padding: 1rem 0; align-items: center;">
                        <label style="font-weight: 600; color: var(--foreground);">Member Since:</label>
                        <span style="color: var(--muted-foreground); font-size: 0.875rem;">
                            ${formatDate(profile.created_at)}
                        </span>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 2rem; padding-top: 2rem; border-top: 1px solid var(--border);">
                    <button class="btn btn-primary" onclick="editProfileName()" style="padding: 0.75rem 2rem; font-size: 1rem;">
                        ✏️ Edit Name
                    </button>
                </div>
            </div>
        `

    console.log('✅ Profile rendered successfully')

  } catch (error) {
    console.error('❌ Error loading profile:', error)
    container.innerHTML = `
            <div style="text-align: center; padding: 3rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
                <p style="color: #ef4444; font-weight: 600; margin-bottom: 0.5rem;">Failed to load profile</p>
                <p style="color: var(--muted-foreground); font-size: 0.875rem;">${error.message}</p>
                <button onclick="loadProfilePage()" class="btn btn-outline" style="margin-top: 1rem;">Retry</button>
            </div>
        `
  }
}

async function editProfileName() {
  const newName = prompt('Enter your new name:')
  if (!newName) return

  try {
    const session = JSON.parse(localStorage.getItem('admin_session'))

    const { error } = await window.supabaseClient
      .from('users')
      .update({ name: newName.trim() })
      .eq('id', session.userId)

    if (error) throw error

    session.name = newName.trim()
    localStorage.setItem('admin_session', JSON.stringify(session))

    await loadProfilePage()
    addNotification('✅ Name updated')

  } catch (error) {
    alert('Failed: ' + error.message)
  }
}
