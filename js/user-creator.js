// ============================================================================
// USER CREATOR - Role-Based User Creation Component
// ============================================================================

class UserCreator {
    constructor() {
        this.currentUserRole = null
    }

    /**
     * Initialize user creator
     */
    init() {
        const session = window.apiClient.getCurrentSession()
        if (session) {
            this.currentUserRole = session.role
        }
    }

    /**
     * Show create user modal
     */
    showCreateUserModal() {
        const isMasterAdmin = this.currentUserRole === 'master_admin'

        const modalHTML = `
            <div class="modal-overlay" id="create-user-modal" onclick="if(event.target===this) userCreator.closeModal()">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Create New User</h2>
                        <button class="modal-close" onclick="userCreator.closeModal()">×</button>
                    </div>

                    <div class="modal-body">
                        <form id="create-user-form" onsubmit="userCreator.handleSubmit(event)">
                            <div class="form-group">
                                <label for="user-email">Email Address *</label>
                                <input 
                                    type="email" 
                                    id="user-email" 
                                    class="form-input" 
                                    required
                                    placeholder="user@example.com"
                                >
                            </div>

                            <div class="form-group">
                                <label for="user-password">Password *</label>
                                <input 
                                    type="password" 
                                    id="user-password" 
                                    class="form-input" 
                                    required
                                    placeholder="Enter password"
                                    minlength="6"
                                >
                            </div>

                            <div class="form-group">
                                <label for="user-name">Full Name</label>
                                <input 
                                    type="text" 
                                    id="user-name" 
                                    class="form-input" 
                                    placeholder="Enter full name (optional)"
                                >
                            </div>

                            ${isMasterAdmin ? `
                            <div class="form-group">
                                <label for="user-role">Account Role *</label>
                                <select id="user-role" class="form-input">
                                    <option value="user">User</option>
                                    <option value="admin">Administrator</option>
                                </select>
                                <small class="form-help">Master admins can create admin accounts</small>
                            </div>
                            ` : ''}

                            <div id="create-user-message" class="message-box" style="display: none;"></div>

                            <div class="modal-footer">
                                <button type="button" class="btn btn-outline" onclick="userCreator.closeModal()">
                                    Cancel
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    Create User
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `

        document.body.insertAdjacentHTML('beforeend', modalHTML)
    }

    /**
     * Handle form submission
     */
    async handleSubmit(event) {
        event.preventDefault()

        const email = document.getElementById('user-email').value.trim()
        const password = document.getElementById('user-password').value
        const name = document.getElementById('user-name').value.trim()

        let role = 'user' // Default
        const roleSelect = document.getElementById('user-role')
        if (roleSelect) {
            role = roleSelect.value
        }

        const userData = {
            email,
            password,
            name: name || null,
            role
        }

        try {
            this.showLoading('Creating user...')

            const newUser = await window.apiClient.createUser(userData)

            this.showSuccess(`User created successfully! Account: ${newUser.email}`)

            // Reload users table
            setTimeout(() => {
                this.closeModal()
                if (window.usersTable) {
                    window.usersTable.loadUsers()
                }
            }, 1500)

        } catch (error) {
            console.error('Error creating user:', error)
            this.showError(error.message || 'Failed to create user')
        }
    }

    /**
     * Close modal
     */
    closeModal() {
        const modal = document.getElementById('create-user-modal')
        if (modal) {
            modal.remove()
        }
    }

    /**
     * Show messages
     */
    showLoading(message) {
        this.showMessage(message, 'loading')
    }

    showSuccess(message) {
        this.showMessage(message, 'success')
    }

    showError(message) {
        this.showMessage(message, 'error')
    }

    showMessage(message, type) {
        const messageBox = document.getElementById('create-user-message')
        if (messageBox) {
            messageBox.textContent = message
            messageBox.className = `message-box ${type}`
            messageBox.style.display = 'block'
        }
    }
}

// Create global instance
window.userCreator = new UserCreator()
