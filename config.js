// ============================================================================
// BANKING DASHBOARD - CONFIGURATION (FIXED VERSION)
// ============================================================================

const CONFIG = {
  supabase: {
    url: 'https://hhudykraoahdkhkzmzcb.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhodWR5a3Jhb2FoZGtoa3ptemNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NzU3NjEsImV4cCI6MjA4NDM1MTc2MX0.xeN-PKlcpF_pAAO-VxMLBpgKxZmetJQBAJR708HDfQU'
  },
  
  otp: {
    length: 6,
    expiryMinutes: 5,
    maxAttempts: 3
  }
}

// Create supabase client - make it globally available
window.supabaseClient = null

// Initialize function
function initializeSupabase() {
  if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
    window.supabaseClient = window.supabase.createClient(
      CONFIG.supabase.url,
      CONFIG.supabase.anonKey
    )
    console.log('✅ Supabase client initialized')
    console.log('🔗 Connected to:', CONFIG.supabase.url)
    return true
  } else {
    console.error('❌ Supabase SDK not available')
    return false
  }
}

// Try to initialize immediately
if (typeof window.supabase !== 'undefined') {
  initializeSupabase()
} else {
  // Wait for SDK to load
  window.addEventListener('load', initializeSupabase)
}