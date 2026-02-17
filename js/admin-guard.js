// ============================================================================
// ADMIN ROUTE PROTECTION
// Prevents unauthorized access to admin dashboard
// Place this script in <head> of admin-dashboard.html
// ============================================================================

(function () {
    'use strict'

    // Check admin session immediately (blocks page load if not authorized)
    const adminSession = localStorage.getItem('admin_session')

    if (!adminSession) {
        // No session found, redirect to login
        console.log('❌ No admin session found. Redirecting to login...')
        window.location.href = '../admin-login.html'
        return
    }

    try {
        const session = JSON.parse(adminSession)

        // Check if session is expired
        const expiresAt = new Date(session.expiresAt)
        const now = new Date()

        if (now > expiresAt) {
            // Session expired, clear and redirect
            console.log('❌ Admin session expired')
            localStorage.removeItem('admin_session')
            localStorage.removeItem('is_admin')
            localStorage.removeItem('admin_role')
            alert('Your session has expired. Please login again.')
            window.location.href = '../admin-login.html'
            return
        }

        // Check if user has admin privileges
        if (!['admin', 'master_admin'].includes(session.role)) {
            console.log('❌ Insufficient permissions:', session.role)
            alert('Access denied. Admin privileges required.')
            window.location.href = '../index.html'
            return
        }

        // Session is valid, allow access
        console.log('✅ Admin access granted:', session.role)
        console.log('👤 Logged in as:', session.name, '(' + session.email + ')')

        // Store role globally for permission checks in dashboard
        window.ADMIN_ROLE = session.role
        window.ADMIN_SESSION = session

        // Helper function to check if user is master admin
        window.isMasterAdmin = function () {
            return session.role === 'master_admin'
        }

        // Helper function to check if user has admin privileges
        window.isAdmin = function () {
            return ['admin', 'master_admin'].includes(session.role)
        }

    } catch (error) {
        // Invalid session data, clear and redirect
        console.error('❌ Invalid session data:', error)
        localStorage.removeItem('admin_session')
        localStorage.removeItem('is_admin')
        localStorage.removeItem('admin_role')
        window.location.href = '../admin-login.html'
    }
})()
