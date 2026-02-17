// ============================================================================
// API CLIENT - Centralized Database Operations
// ============================================================================

class APIClient {
    constructor() {
        this.supabase = window.supabaseClient
    }

    // ========================================================================
    // AUTHENTICATION & SESSION
    // ========================================================================

    /**
     * Get current admin session from localStorage
     */
    getCurrentSession() {
        const sessionData = localStorage.getItem('admin_session')
        if (!sessionData) return null

        try {
            return JSON.parse(sessionData)
        } catch (error) {
            console.error('Invalid session data:', error)
            return null
        }
    }

    /**
     * Update last_seen timestamp (track online status)
     */
    async updateLastSeen(userId) {
        try {
            const { error } = await this.supabase
                .from('users')
                .update({
                    last_seen: new Date().toISOString()
                })
                .eq('id', userId)

            if (error) {
                console.error('Error updating last_seen:', error)
            }
        } catch (error) {
            console.error('Error updating last_seen:', error)
        }
    }

    /**
     * Check if session is valid and update last_seen
     */
    async validateAndRefreshSession() {
        const session = this.getCurrentSession()
        if (!session) return false

        // Check expiration
        const expiresAt = new Date(session.expiresAt)
        if (new Date() > expiresAt) {
            this.clearSession()
            return false
        }

        // Update last_seen
        await this.updateLastSeen(session.userId)

        return true
    }

    /**
     * Clear admin session
     */
    clearSession() {
        localStorage.removeItem('admin_session')
        localStorage.removeItem('is_admin')
        localStorage.removeItem('admin_role')
    }

    // ========================================================================
    // PROFILE MANAGEMENT
    // ========================================================================

    /**
     * Fetch current admin profile
     */
    async getMyProfile() {
        const session = this.getCurrentSession()
        if (!session) {
            throw new Error('No active session')
        }

        try {
            const { data, error } = await this.supabase
                .from('users')
                .select('id, email, name, role, is_active, last_seen, created_at')
                .eq('id', session.userId)
                .single()

            if (error) throw error

            // Update last_seen while fetching
            await this.updateLastSeen(session.userId)

            return data
        } catch (error) {
            console.error('Error fetching profile:', error)
            throw error
        }
    }

    /**
     * Update admin profile
     * @param {Object} updates - Fields to update (email, name)
     */
    async updateMyProfile(updates) {
        const session = this.getCurrentSession()
        if (!session) {
            throw new Error('No active session')
        }

        // Security: Remove fields that shouldn't be updated via profile
        const allowedFields = ['name', 'email']
        const sanitizedUpdates = {}

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                sanitizedUpdates[field] = updates[field]
            }
        }

        // Prevent empty name
        if (sanitizedUpdates.name !== undefined) {
            sanitizedUpdates.name = sanitizedUpdates.name.trim()
            if (sanitizedUpdates.name.length === 0) {
                throw new Error('Name cannot be empty')
            }
        }

        try {
            const { data, error } = await this.supabase
                .from('users')
                .update(sanitizedUpdates)
                .eq('id', session.userId)
                .select()
                .single()

            if (error) throw error

            // Update session if email or name changed
            if (sanitizedUpdates.email || sanitizedUpdates.name) {
                const updatedSession = {
                    ...session,
                    email: sanitizedUpdates.email || session.email,
                    name: sanitizedUpdates.name || session.name
                }
                localStorage.setItem('admin_session', JSON.stringify(updatedSession))
            }

            return data
        } catch (error) {
            console.error('Error updating profile:', error)
            throw error
        }
    }

    // ========================================================================
    // USER MANAGEMENT
    // ========================================================================

    /**
     * Get all users (filtered by role)
     */
    async getAllUsers() {
        const session = this.getCurrentSession()
        if (!session) throw new Error('No active session')

        await this.updateLastSeen(session.userId)

        try {
            let query = this.supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false })

            // Role-based filtering
            if (session.role === 'admin') {
                // Normal admins cannot see master admins
                query = query.neq('role', 'master_admin')
            }
            // Master admins see everyone (no filter)

            const { data, error } = await query

            if (error) throw error

            return data
        } catch (error) {
            console.error('Error fetching users:', error)
            throw error
        }
    }

    /**
     * Create new user
     * @param {Object} userData - User data (email, password, name, role)
     */
    async createUser(userData) {
        const session = this.getCurrentSession()
        if (!session) throw new Error('No active session')

        // Validate required fields
        if (!userData.email || !userData.password) {
            throw new Error('Email and password are required')
        }

        // Role enforcement based on logged-in user
        let assignedRole = 'user' // Default

        if (session.role === 'master_admin') {
            // Master admin can assign admin or user
            if (userData.role === 'admin' || userData.role === 'user') {
                assignedRole = userData.role
            } else {
                assignedRole = 'user' // Fallback
            }
        } else if (session.role === 'admin') {
            // Regular admin can only create users
            assignedRole = 'user'
        }

        // Security: Never allow creating master_admin
        if (userData.role === 'master_admin') {
            throw new Error('Cannot create master admin accounts')
        }

        // Check if email already exists
        const { data: existing } = await this.supabase
            .from('users')
            .select('id, email, role')
            .eq('email', userData.email)

        if (existing && existing.length > 0) {
            throw new Error('User with this email already exists')
        }

        // Create user
        try {
            const { data, error } = await this.supabase
                .from('users')
                .insert([{
                    email: userData.email.trim().toLowerCase(),
                    password: userData.password, // Plain text for now
                    name: userData.name?.trim() || null,
                    role: assignedRole,
                    is_active: true,
                    created_at: new Date().toISOString()
                }])
                .select()
                .single()

            if (error) throw error

            // Create account for the new user
            const accountNumber = this.generateAccountNumber(assignedRole)

            await this.supabase
                .from('accounts')
                .insert([{
                    user_id: data.id,
                    account_number: accountNumber,
                    balance: 0,
                    created_at: new Date().toISOString()
                }])

            return data
        } catch (error) {
            console.error('Error creating user:', error)
            throw error
        }
    }

    /**
     * Update user (admin operation)
     */
    async updateUser(userId, updates) {
        const session = this.getCurrentSession()
        if (!session) throw new Error('No active session')

        // Get target user
        const { data: targetUser } = await this.supabase
            .from('users')
            .select('role')
            .eq('id', userId)
            .single()

        if (!targetUser) {
            throw new Error('User not found')
        }

        // Prevent modifying master admin (except by master admin)
        if (targetUser.role === 'master_admin' && session.role !== 'master_admin') {
            throw new Error('Cannot modify master admin account')
        }

        // Security: Remove fields that shouldn't be updated
        const allowedFields = ['name', 'email', 'is_active']
        const sanitizedUpdates = {}

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                sanitizedUpdates[field] = updates[field]
            }
        }

        // Prevent deactivating master admin
        if (targetUser.role === 'master_admin' && sanitizedUpdates.is_active === false) {
            throw new Error('Cannot deactivate master admin')
        }

        try {
            const { data, error } = await this.supabase
                .from('users')
                .update(sanitizedUpdates)
                .eq('id', userId)
                .select()
                .single()

            if (error) throw error

            return data
        } catch (error) {
            console.error('Error updating user:', error)
            throw error
        }
    }

    /**
     * Delete user (admin operation)
     */
    async deleteUser(userId) {
        const session = this.getCurrentSession()
        if (!session) throw new Error('No active session')

        // Get target user
        const { data: targetUser } = await this.supabase
            .from('users')
            .select('role, email')
            .eq('id', userId)
            .single()

        if (!targetUser) {
            throw new Error('User not found')
        }

        // Prevent deleting master admin
        if (targetUser.role === 'master_admin') {
            throw new Error('Cannot delete master admin account')
        }

        // Prevent normal admin from deleting other admins
        if (session.role === 'admin' && targetUser.role === 'admin') {
            throw new Error('Cannot delete other admin accounts')
        }

        try {
            // Delete associated accounts first
            await this.supabase
                .from('accounts')
                .delete()
                .eq('user_id', userId)

            // Delete user
            const { error } = await this.supabase
                .from('users')
                .delete()
                .eq('id', userId)

            if (error) throw error

            return true
        } catch (error) {
            console.error('Error deleting user:', error)
            throw error
        }
    }

    /**
     * Toggle user active status
     */
    async toggleUserStatus(userId, isActive) {
        return await this.updateUser(userId, { is_active: isActive })
    }

    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================

    /**
     * Generate account number based on role
     */
    generateAccountNumber(role) {
        const prefix = role === 'admin' ? 'ADMIN' : 'USER'
        const randomNum = Math.floor(Math.random() * 100000000).toString().padStart(8, '0')
        return `${prefix}${randomNum}`
    }

    /**
     * Calculate online status from last_seen
     */
    getOnlineStatus(lastSeen) {
        if (!lastSeen) return 'Never Logged In'

        const lastSeenDate = new Date(lastSeen)
        const now = new Date()
        const diffMinutes = (now - lastSeenDate) / (1000 * 60)

        if (diffMinutes <= 5) return 'Online'
        return 'Offline'
    }

    /**
     * Format timestamp
     */
    formatTimestamp(timestamp) {
        if (!timestamp) return 'Never'
        return new Date(timestamp).toLocaleString()
    }
}

// Create global API client instance
window.apiClient = new APIClient()
