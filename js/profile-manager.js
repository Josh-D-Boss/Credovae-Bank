// ============================================================================
// PROFILE MANAGER - Admin Profile Fetch & Edit
// ============================================================================

class ProfileManager {
    constructor() {
        this.currentProfile = null
        this.isEditing = false
    }

    /**
     * Initialize profile manager
     */
    async init() {
        try {
            // Fetch current profile
            this.currentProfile = await window.apiClient.getMyProfile()
            this.render()
        } catch (error) {
            console.error('Error loading profile:', error)
            this.showError('Failed to load profile')
        }
    }

    /**
     * Render profile view
     */
    render() {
        const container = document.getElementById('profile-content-container')
        if (!container) return

        const profile = this.currentProfile

        container.innerHTML = `
            <div class="profile-container">
                <div class="profile-header">
                    <div class="profile-avatar">
                        ${this.getAvatarInitials(profile.name || profile.email)}
                    </div>
                    <div class="profile-info">
                        <h2>${profile.name || 'No Name Set'}</h2>
                        <p class="profile-email">${profile.email}</p>
                        <span class="role-badge role-${profile.role}">${this.formatRole(profile.role)}</span>
                    </div>
                </div>

                <div class="profile-details">
                    <h3>Account Information</h3>
                    
                    <div class="detail-row">
                        <label>Full Name</label>
                        <div class="detail-value" id="name-display">
                            ${profile.name || '<span class="text-muted">Not set</span>'}
                        </div>
                        <input 
                            type="text" 
                            id="name-input" 
                            class="form-input" 
                            value="${profile.name || ''}" 
                            style="display: none;"
                            placeholder="Enter your name"
                        >
                    </div>

                    <div class="detail-row">
                        <label>Email Address</label>
                        <div class="detail-value">
                            ${profile.email}
                        </div>
                    </div>

                    <div class="detail-row">
                        <label>Role</label>
                        <div class="detail-value">
                            <span class="role-badge role-${profile.role}">${this.formatRole(profile.role)}</span>
                        </div>
                    </div>

                    <div class="detail-row">
                        <label>Account Status</label>
                        <div class="detail-value">
                            <span class="status-badge status-${profile.is_active ? 'active' : 'inactive'}">
                                ${profile.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </div>

                    <div class="detail-row">
                        <label>Last Seen</label>
                        <div class="detail-value">
                            ${window.apiClient.formatTimestamp(profile.last_seen)}
                            <span class="online-indicator ${this.getOnlineClass(profile.last_seen)}">
                                ${window.apiClient.getOnlineStatus(profile.last_seen)}
                            </span>
                        </div>
                    </div>

                    <div class="detail-row">
                        <label>Member Since</label>
                        <div class="detail-value">
                            ${window.apiClient.formatTimestamp(profile.created_at)}
                        </div>
                    </div>
                </div>

                <div class="profile-actions">
                    <button 
                        id="edit-profile-btn" 
                        class="btn btn-primary"
                        onclick="profileManager.toggleEdit()"
                    >
                        Edit Profile
                    </button>
                    <button 
                        id="save-profile-btn" 
                        class="btn btn-primary" 
                        style="display: none;"
                        onclick="profileManager.saveProfile()"
                    >
                        Save Changes
                    </button>
                    <button 
                        id="cancel-edit-btn" 
                        class="btn btn-outline" 
                        style="display: none;"
                        onclick="profileManager.cancelEdit()"
                    >
                        Cancel
                    </button>
                </div>

                <div id="profile-message" class="message-box" style="display: none;"></div>
            </div>
        `
    }

    /**
     * Toggle edit mode
     */
    toggleEdit() {
        this.isEditing = !this.isEditing

        const nameDisplay = document.getElementById('name-display')
        const nameInput = document.getElementById('name-input')
        const editBtn = document.getElementById('edit-profile-btn')
        const saveBtn = document.getElementById('save-profile-btn')
        const cancelBtn = document.getElementById('cancel-edit-btn')

        if (this.isEditing) {
            // Show input, hide display
            nameDisplay.style.display = 'none'
            nameInput.style.display = 'block'
            nameInput.focus()

            // Show save/cancel, hide edit
            editBtn.style.display = 'none'
            saveBtn.style.display = 'inline-block'
            cancelBtn.style.display = 'inline-block'
        } else {
            // Show display, hide input
            nameDisplay.style.display = 'block'
            nameInput.style.display = 'none'

            // Show edit, hide save/cancel
            editBtn.style.display = 'inline-block'
            saveBtn.style.display = 'none'
            cancelBtn.style.display = 'none'
        }
    }

    /**
     * Save profile changes
     */
    async saveProfile() {
        const nameInput = document.getElementById('name-input')
        const newName = nameInput.value.trim()

        if (!newName) {
            this.showError('Name cannot be empty')
            return
        }

        try {
            this.showLoading('Saving changes...')

            const updates = { name: newName }
            const updatedProfile = await window.apiClient.updateMyProfile(updates)

            this.currentProfile = updatedProfile
            this.isEditing = false

            this.showSuccess('Profile updated successfully!')

            // Re-render to show new data
            setTimeout(() => {
                this.render()
            }, 1500)

        } catch (error) {
            console.error('Error saving profile:', error)
            this.showError(error.message || 'Failed to save profile')
        }
    }

    /**
     * Cancel edit mode
     */
    cancelEdit() {
        this.isEditing = false
        this.render()
    }

    /**
     * Get avatar initials
     */
    getAvatarInitials(text) {
        if (!text) return '?'
        const words = text.trim().split(' ')
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase()
        }
        return text.substring(0, 2).toUpperCase()
    }

    /**
     * Format role for display
     */
    formatRole(role) {
        const roleMap = {
            'master_admin': 'Master Administrator',
            'admin': 'Administrator',
            'user': 'User'
        }
        return roleMap[role] || role
    }

    /**
     * Get online status class
     */
    getOnlineClass(lastSeen) {
        const status = window.apiClient.getOnlineStatus(lastSeen)
        if (status === 'Online') return 'online'
        if (status === 'Offline') return 'offline'
        return 'never'
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        const messageBox = document.getElementById('profile-message')
        if (messageBox) {
            messageBox.textContent = message
            messageBox.className = 'message-box success'
            messageBox.style.display = 'block'

            setTimeout(() => {
                messageBox.style.display = 'none'
            }, 3000)
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const messageBox = document.getElementById('profile-message')
        if (messageBox) {
            messageBox.textContent = message
            messageBox.className = 'message-box error'
            messageBox.style.display = 'block'
        }
    }

    /**
     * Show loading message
     */
    showLoading(message) {
        const messageBox = document.getElementById('profile-message')
        if (messageBox) {
            messageBox.textContent = message
            messageBox.className = 'message-box loading'
            messageBox.style.display = 'block'
        }
    }
}

// Create global instance
window.profileManager = new ProfileManager()
