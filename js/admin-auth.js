// ============================================================================
// ADMIN AUTHENTICATION SYSTEM
// Handles secure login for admin and master_admin roles
// ============================================================================

class AdminAuth {
    constructor() {
        this.form = document.getElementById('admin-login-form')
        this.emailInput = document.getElementById('admin-email')
        this.passwordInput = document.getElementById('admin-password')
        this.loginButton = document.getElementById('login-button')
        this.buttonText = document.getElementById('button-text')
        this.errorMessage = document.getElementById('error-message')

        this.init()
    }

    init() {
        // Check if already logged in
        this.checkExistingSession()

        // Setup form submission
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleLogin(e))
        }
    }

    async checkExistingSession() {
        const adminSession = localStorage.getItem('admin_session')

        if (adminSession) {
            try {
                const session = JSON.parse(adminSession)
                const isValid = await this.validateSession(session)

                if (isValid) {
                    // Already logged in, redirect to dashboard
                    window.location.href = 'admin-dashboard-design/admin-dashboard.html'
                } else {
                    // Invalid session, clear it
                    localStorage.removeItem('admin_session')
                    localStorage.removeItem('is_admin')
                    localStorage.removeItem('admin_role')
                }
            } catch (error) {
                localStorage.removeItem('admin_session')
                localStorage.removeItem('is_admin')
                localStorage.removeItem('admin_role')
            }
        }
    }

    async validateSession(session) {
        try {
            const { data, error } = await window.supabaseClient
                .from('users')
                .select('id, email, name, role')
                .eq('id', session.userId)
                .eq('role', session.role)
                .single()

            if (error || !data) return false

            // Check if role is admin or master_admin
            return ['admin', 'master_admin'].includes(data.role)
        } catch (error) {
            return false
        }
    }

    async handleLogin(e) {
        e.preventDefault()

        const email = this.emailInput.value.trim()
        const password = this.passwordInput.value

        // Validate inputs
        if (!email || !password) {
            this.showError('Please enter both email and password')
            return
        }

        // Show loading state
        this.setLoading(true)
        this.hideError()

        try {
            // Attempt login
            const result = await this.authenticateAdmin(email, password)

            if (result.success) {
                // Store session
                this.createSession(result.user)

                // Show success message
                this.showSuccess('Login successful! Redirecting...')

                // Redirect to admin dashboard
                setTimeout(() => {
                    window.location.href = 'admin-dashboard-design/admin-dashboard.html'
                }, 500)
            } else {
                this.showError(result.message)
                this.setLoading(false)
            }
        } catch (error) {
            console.error('Login error:', error)
            this.showError('An unexpected error occurred. Please try again.')
            this.setLoading(false)
        }
    }

    async authenticateAdmin(email, password) {
        try {
            // Query users table for admin/master_admin with this email
            const { data: users, error } = await window.supabaseClient
                .from('users')
                .select('id, email, name, password, role')
                .eq('email', email)
                .in('role', ['admin', 'master_admin'])

            if (error) {
                console.error('Database error:', error)
                return {
                    success: false,
                    message: 'Database error. Please contact support.'
                }
            }

            if (!users || users.length === 0) {
                return {
                    success: false,
                    message: 'Invalid credentials or insufficient permissions'
                }
            }

            // Get the admin/master_admin user
            const user = users[0]

            // Verify password (simple check - upgrade to bcrypt in production)
            const isValidPassword = await this.verifyPassword(password, user.password)

            if (!isValidPassword) {
                return {
                    success: false,
                    message: 'Invalid credentials'
                }
            }

            // Double-check role permissions
            if (!['admin', 'master_admin'].includes(user.role)) {
                return {
                    success: false,
                    message: 'Access denied. Admin privileges required.'
                }
            }

            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                }
            }
        } catch (error) {
            console.error('Authentication error:', error)
            return {
                success: false,
                message: 'Authentication failed. Please try again.'
            }
        }
    }

    async verifyPassword(plainPassword, storedPassword) {
        // Simple password verification
        // In production, use bcrypt: await bcrypt.compare(plainPassword, storedPassword)
        return plainPassword === storedPassword
    }

    createSession(user) {
        const session = {
            userId: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            loginTime: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        }

        localStorage.setItem('admin_session', JSON.stringify(session))
        localStorage.setItem('is_admin', 'true')
        localStorage.setItem('admin_role', user.role)

        console.log('✅ Admin session created:', user.role)
    }

    showError(message) {
        this.errorMessage.textContent = message
        this.errorMessage.classList.add('show')
        this.errorMessage.style.background = '#fee2e2'
        this.errorMessage.style.color = '#991b1b'
    }

    showSuccess(message) {
        this.errorMessage.textContent = message
        this.errorMessage.classList.add('show')
        this.errorMessage.style.background = '#dcfce7'
        this.errorMessage.style.color = '#166534'
    }

    hideError() {
        this.errorMessage.classList.remove('show')
    }

    setLoading(loading) {
        if (loading) {
            this.loginButton.disabled = true
            this.buttonText.innerHTML = '<span class="loading-spinner"></span>Authenticating...'
        } else {
            this.loginButton.disabled = false
            this.buttonText.textContent = 'Secure Login'
        }
    }
}

// Initialize admin authentication when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new AdminAuth()
    })
} else {
    new AdminAuth()
}
