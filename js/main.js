/**
 * Main JavaScript - UI Interactions and Mobile Navigation
 * 
 * Features:
 * - Mobile navigation toggle
 * - Smooth scroll behavior
 * - Navigation link highlighting
 * - Responsive interactions
 */

class UIController {
    constructor() {
        this.hamburger = document.getElementById('hamburger');
        this.navMenu = document.getElementById('navMenu');
        this.navLinks = document.querySelectorAll('.nav-link');

        // Initialize event listeners
        this.setupMobileNavigation();
        this.setupNavLinkHighlight();
        this.setupSmoothScroll();
    }

    /**
     * Set up mobile navigation toggle
     * Toggles menu visibility on hamburger click
     */
    setupMobileNavigation() {
        if (!this.hamburger || !this.navMenu) {
            return;
        }

        // Toggle menu on hamburger click
        this.hamburger.addEventListener('click', () => {
            this.toggleMobileMenu();
        });

        // Close menu when a nav link is clicked
        this.navLinks.forEach((link) => {
            link.addEventListener('click', () => {
                this.closeMobileMenu();
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            const isClickInside =
                this.navMenu.contains(e.target) || this.hamburger.contains(e.target);
            if (!isClickInside && this.navMenu.classList.contains('active')) {
                this.closeMobileMenu();
            }
        });
    }

    /**
     * Toggle mobile menu visibility
     */
    toggleMobileMenu() {
        const isActive = this.navMenu.classList.contains('active');

        if (isActive) {
            this.closeMobileMenu();
        } else {
            this.openMobileMenu();
        }
    }

    /**
     * Open mobile menu
     */
    openMobileMenu() {
        this.navMenu.classList.add('active');
        this.hamburger.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close mobile menu
     */
    closeMobileMenu() {
        this.navMenu.classList.remove('active');
        this.hamburger.classList.remove('active');
        document.body.style.overflow = 'auto';
    }

    /**
     * Set up navigation link highlight based on current page
     * Highlights the active navigation link
     */
    setupNavLinkHighlight() {
        const currentPage = this.getCurrentPage();

        this.navLinks.forEach((link) => {
            const href = link.getAttribute('href');

            // Check if link matches current page
            if (href === currentPage) {
                link.classList.add('active');
                link.setAttribute('aria-current', 'page');
            } else {
                link.classList.remove('active');
                link.removeAttribute('aria-current');
            }
        });
    }

    /**
     * Get current page filename
     * @returns {string} - Current page filename
     */
    getCurrentPage() {
        const pathname = window.location.pathname;
        const filename = pathname.substring(pathname.lastIndexOf('/') + 1);

        // Default to index.html for root path
        return filename || 'index.html';
    }

    /**
     * Set up smooth scroll behavior
     * Adds smooth transitions for internal navigation
     */
    setupSmoothScroll() {
        this.navLinks.forEach((link) => {
            link.addEventListener('click', (e) => {
                // Only handle local links
                const href = link.getAttribute('href');
                if (href.startsWith('#')) {
                    e.preventDefault();
                    const target = document.querySelector(href);
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            });
        });
    }
}

/**
 * Enhanced Button Interactions
 * Adds hover and click effects to buttons
 */
class ButtonController {
    constructor() {
        this.buttons = document.querySelectorAll('.btn-primary, .btn-login');
        this.setupButtonInteractions();
    }

    /**
     * Set up button interactions
     */
    setupButtonInteractions() {
        this.buttons.forEach((button) => {
            // Add focus state for accessibility
            button.addEventListener('focus', function () {
                this.style.outline = 'none';
                this.style.boxShadow = '0 0 0 3px rgba(30, 64, 175, 0.1)';
            });

            button.addEventListener('blur', function () {
                this.style.boxShadow = '';
            });

            // Add click ripple effect
            button.addEventListener('click', (e) => {
                this.createRipple(e);
            });
        });
    }

    /**
     * Create ripple effect on button click
     * @param {Event} e - Click event
     */
    createRipple(e) {
        const button = e.target.closest('button, a');
        if (!button) {
            return;
        }

        // Get position of click
        const rect = button.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Create ripple element
        const ripple = document.createElement('span');
        ripple.style.position = 'absolute';
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        ripple.style.width = '20px';
        ripple.style.height = '20px';
        ripple.style.background = 'rgba(255, 255, 255, 0.5)';
        ripple.style.borderRadius = '50%';
        ripple.style.transform = 'scale(0)';
        ripple.style.animation = 'ripple-animation 0.6s ease-out';
        ripple.style.pointerEvents = 'none';

        // Add ripple animation
        if (!button.style.position || button.style.position === 'static') {
            button.style.position = 'relative';
        }

        button.appendChild(ripple);

        // Remove ripple after animation
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }
}

/**
 * Page Load Effects
 * Adds subtle animations and effects on page load
 */
class PageEffects {
    constructor() {
        this.setupPageLoad();
        this.setupScrollAnimations();
    }

    /**
     * Set up page load animation
     */
    setupPageLoad() {
        const hero = document.querySelector('.hero');
        const pageHero = document.querySelector('.page-hero');

        if (hero || pageHero) {
            const targetElement = hero || pageHero;
            targetElement.style.opacity = '0';
            targetElement.style.transform = 'translateY(20px)';

            // Trigger animation after a small delay
            setTimeout(() => {
                targetElement.style.transition = 'all 0.6s ease-out';
                targetElement.style.opacity = '1';
                targetElement.style.transform = 'translateY(0)';
            }, 100);
        }
    }

    /**
     * Set up scroll animations
     * Animates elements as they come into view
     */
    setupScrollAnimations() {
        const cards = document.querySelectorAll(
            '.benefit-card, .service-card, .value-card, .presence-item, .clientele-item, .standard-card'
        );

        if (!('IntersectionObserver' in window)) {
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }
                });
            },
            {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px',
            }
        );

        cards.forEach((card) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
            observer.observe(card);
        });
    }
}

/**
 * Accessibility Enhancements
 */
class AccessibilityController {
    constructor() {
        this.setupKeyboardNavigation();
        this.setupAriaLabels();
    }

    /**
     * Set up keyboard navigation
     * Allows users to navigate with keyboard
     */
    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            // Close mobile menu on Escape
            if (e.key === 'Escape') {
                const navMenu = document.getElementById('navMenu');
                const hamburger = document.getElementById('hamburger');

                if (navMenu && hamburger) {
                    navMenu.classList.remove('active');
                    hamburger.classList.remove('active');
                    document.body.style.overflow = 'auto';
                }
            }
        });
    }

    /**
     * Set up ARIA labels for better accessibility
     */
    setupAriaLabels() {
        // Set up nav menu ARIA attributes
        const navMenu = document.getElementById('navMenu');
        if (navMenu) {
            navMenu.setAttribute('aria-label', 'Main navigation');
        }

        // Set up main content area
        const main = document.querySelector('main');
        if (!main) {
            // Ensure main content is semantically marked
            const hero = document.querySelector('.hero');
            if (hero) {
                hero.setAttribute('role', 'main');
            }
        }
    }
}

/**
 * Initialize all controllers and features
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI controller for navigation
    new UIController();

    // Initialize button interactions
    new ButtonController();

    // Initialize page effects
    new PageEffects();

    // Initialize accessibility features
    new AccessibilityController();

    console.log('[Global Offshore Bank] Application initialized successfully');
});

/**
 * Ripple animation CSS
 * Inject keyframes for ripple effect
 */
const style = document.createElement('style');
style.textContent = `
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
