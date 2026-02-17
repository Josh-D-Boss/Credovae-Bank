// ============================================================================
// USERS TABLE - Display users with role, status, and online indicators
// ============================================================================

class UsersTable {
    constructor() {
        this.users = []
        this.currentUserRole = null
    }

    /**
     * Initialize and load users
     */
    async init() {
        const session = window.apiClient.getCurrentSession()
        if (session) {
            this.currentUserRole = session.role
        }

        await this.loadUsers()
    }

    /**
     * Load users from database
     */
    async loadUsers() {
        try {
            this.showLoading()
            this.users = await window.apiClient.getAllUsers()
            this.render()
        } catch (error) {
            console.error('Error loading users:', error)
            this.showError('Failed to load users')
        }
    }

    /**
     * Render users table
     */
    render() {
        const container = document.getElementById('users-table-container')
        if (!container) return

        const isMasterAdmin = this.currentUserRole === 'master_admin'

        let tableHTML = `
            <div class="table-header">
                <h3>Users Management</h3>
                <button class="btn btn-primary" onclick="userCreator.showCreateUserModal()">
                    + Create User
                </button>
            </div>

            <div class="table-wrapper">
                <table class="users-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Account Status</th>
                            <th>Online Status</th>
                            <th>Last Seen</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `

        if (this.users.length === 0) {
            tableHTML += `
                <tr>
                    <td colspan="7" class="text-center text-muted">
                        No users found
                    </td>
                </tr>
            `
        } else {
            this.users.forEach(user => {
                const onlineStatus = window.apiClient.getOnlineStatus(user.last_seen)
                const onlineClass = this.getOnlineClass(onlineStatus)
                const isMasterAdminUser = user.role === 'master_admin'
                const canEdit = isMasterAdmin || !isMasterAdminUser

                tableHTML += `
                    <tr>
                        <td>
                            <div class="user-name">
                                ${user.name || '<span class="text-muted">No name</span>'}
                            </div>
                        </td>
                        <td>${user.email}</td>
                        <td>
                            <span class="role-badge role-${user.role}">
                                ${this.formatRole(user.role)}
                            </span>
                        </td>
                        <td>
                            <label class="toggle-switch ${!canEdit ? 'disabled' : ''}">
                                <input 
                                    type="checkbox" 
                                    ${user.is_active ? 'checked' : ''} 
                                    ${!canEdit ? 'disabled' : ''}
                                    onchange="usersTable.toggleStatus('${user.id}', this.checked)"
                                >
                                <span class="toggle-slider"></span>
                            </label>
                            <span class="status-text">
                                ${user.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td>
                            <span class="online-indicator ${onlineClass}">
                                <span class="status-dot"></span>
                                ${onlineStatus}
                            </span>
                        </td>
                        <td class="text-muted text-sm">
                            ${window.apiClient.formatTimestamp(user.last_seen)}
                        </td>
                        <td>
                            <div class="action-buttons">
                                ${canEdit ? `
                                <button 
                                    class="btn-icon" 
                                    onclick="usersTable.editUser('${user.id}')"
                                    title="Edit user"
                                >
                                    ✏️
                                </button>
                                ${!isMasterAdminUser ? `
                                <button 
                                    class="btn-icon btn-danger" 
                                    onclick="usersTable.deleteUser('${user.id}', '${user.email}')"
                                    title="Delete user"
                                >
                                    🗑️
                                </button>
                                ` : ''}
                                ` : `
                                <span class="text-muted text-sm">Protected</span>
                                `}
                            </div>
                        </td>
                    </tr>
                `
            })
        }

        tableHTML += `
                    </tbody>
                </table>
            </div>

            <div class="table-footer">
                <p class="text-muted">
                    Total: ${this.users.length} ${this.users.length === 1 ? 'user' : 'users'}
                </p>
            </div>
        `

        container.innerHTML = tableHTML
    }

    /**
     * Toggle user active status
     */
    async toggleStatus(userId, isActive) {
        try {
            await window.apiClient.toggleUserStatus(userId, isActive)
            await this.loadUsers() // Reload to show changes
        } catch (error) {
            console.error('Error toggling status:', error)
            alert(error.message || 'Failed to update status')
            await this.loadUsers() // Reload to reset toggle
        }
    }

    /**
     * Edit user
     */
    async editUser(userId) {
        const user = this.users.find(u => u.id === userId)
        if (!user) return

        const newName = prompt('Enter new name:', user.name || '')
        if (newName === null) return // Cancelled

        try {
            await window.apiClient.updateUser(userId, { name: newName.trim() })
            alert('User updated successfully')
            await this.loadUsers()
        } catch (error) {
            console.error('Error updating user:', error)
            alert(error.message || 'Failed to update user')
        }
    }

    /**
     * Delete user
     */
    async deleteUser(userId, email) {
        if (!confirm(`Are you sure you want to delete user "${email}"?\n\nThis action cannot be undone.`)) {
            return
        }

        try {
            await window.apiClient.deleteUser(userId)
            alert('User deleted successfully')
            await this.loadUsers()
        } catch (error) {
            console.error('Error deleting user:', error)
            alert(error.message || 'Failed to delete user')
        }
    }

    /**
     * Format role for display
     */
    formatRole(role) {
        const roleMap = {
            'master_admin': 'Master Admin',
            'admin': 'Admin',
            'user': 'User'
        }
        return roleMap[role] || role
    }

    /**
     * Get online status class
     */
    getOnlineClass(status) {
        if (status === 'Online') return 'online'
        if (status === 'Offline') return 'offline'
        return 'never'
    }

    /**
     * Show loading state
     */
    showLoading() {
        const container = document.getElementById('users-table-container')
        if (container) {
            container.innerHTML = '<div class="loading-spinner">Loading users...</div>'
        }
    }

    /**
     * Show error
     */
    showError(message) {
        const container = document.getElementById('users-table-container')
        if (container) {
            container.innerHTML = `<div class="error-message">${message}</div>`
        }
    }
}

// Create global instance
window.usersTable = new UsersTable()
