/**
 * Theme System - Manages Light/Dark mode switching with localStorage persistence
 * 
 * Features:
 * - Smooth theme transitions
 * - localStorage persistence across pages
 * - Automatic theme application on page load
 * - CSS variable-based theming for dynamic styling
 */

class ThemeManager {
    constructor() {
        this.THEME_STORAGE_KEY = 'global-offshore-theme';
        this.LIGHT_THEME = 'light';
        this.DARK_THEME = 'dark';
        this.DEFAULT_THEME = this.LIGHT_THEME;

        // Initialize theme on page load
        this.initializeTheme();

        // Set up event listeners
        this.setupEventListeners();
    }

    /**
     * Initialize theme on page load
     * Applies saved theme or defaults to light mode
     */
    initializeTheme() {
        const savedTheme = this.getSavedTheme();
        const preferredTheme = savedTheme || this.DEFAULT_THEME;

        // Remove any existing theme class first
        document.documentElement.classList.remove('dark-mode');

        // Apply the theme
        this.applyTheme(preferredTheme);

        // Update theme toggle button icon
        this.updateThemeToggleIcon(preferredTheme);
    }

    /**
     * Get the saved theme from localStorage
     * @returns {string|null} - Saved theme or null if not found
     */
    getSavedTheme() {
        try {
            return localStorage.getItem(this.THEME_STORAGE_KEY);
        } catch (error) {
            console.warn('localStorage not available:', error);
            return null;
        }
    }

    /**
     * Save theme preference to localStorage
     * @param {string} theme - Theme to save
     */
    saveTheme(theme) {
        try {
            localStorage.setItem(this.THEME_STORAGE_KEY, theme);
        } catch (error) {
            console.warn('Could not save theme to localStorage:', error);
        }
    }

    /**
     * Apply theme to the document
     * Updates CSS variables and document class
     * @param {string} theme - Theme to apply
     */
    applyTheme(theme) {
        if (theme === this.DARK_THEME) {
            document.documentElement.classList.add('dark-mode');
            this.saveTheme(this.DARK_THEME);
        } else {
            document.documentElement.classList.remove('dark-mode');
            this.saveTheme(this.LIGHT_THEME);
        }
    }

    /**
     * Get current theme
     * @returns {string} - Current theme
     */
    getCurrentTheme() {
        return document.documentElement.classList.contains('dark-mode')
            ? this.DARK_THEME
            : this.LIGHT_THEME;
    }

    /**
     * Toggle between light and dark theme
     */
    toggleTheme() {
        const currentTheme = this.getCurrentTheme();
        const newTheme = currentTheme === this.LIGHT_THEME ? this.DARK_THEME : this.LIGHT_THEME;

        this.applyTheme(newTheme);
        this.updateThemeToggleIcon(newTheme);
    }

    /**
     * Update theme toggle button icon
     * @param {string} theme - Current theme
     */
    updateThemeToggleIcon(theme) {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const themeIcon = themeToggle.querySelector('.theme-icon');
            if (themeIcon) {
                // Sun icon for light mode, moon icon for dark mode
                themeIcon.textContent = theme === this.DARK_THEME ? '🌙' : '☀️';
            }
        }
    }

    /**
     * Set up event listeners for theme toggle
     */
    setupEventListeners() {
        const themeToggle = document.getElementById('themeToggle');

        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });

            // Add keyboard support for accessibility
            themeToggle.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.toggleTheme();
                }
            });
        }
    }
}

// Initialize theme manager when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.themeManager = new ThemeManager();
    });
} else {
    // DOM is already loaded
    window.themeManager = new ThemeManager();
}
