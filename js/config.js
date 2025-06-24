// Application configuration and constants
export const CONFIG = {
    // Performance settings
    RENDER_TIMEOUT: 500,
    RESIZE_DEBOUNCE: 100,
    FILTER_DEBOUNCE: 200,

    // Layout engines
    DEFAULT_LAYOUT: 'dot',
    SUPPORTED_LAYOUTS: ['dot', 'neato', 'fdp', 'circo', 'twopi'],

    // File handling
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    SUPPORTED_EXTENSIONS: ['.dot', '.gv'],

    // Notification settings
    MESSAGE_TIMEOUT: {
        ERROR: 6000,
        WARNING: 4000,
        INFO: 3000,
        SUCCESS: 3000
    },

    // UI settings
    MAX_NOTIFICATIONS: 5,
    ANIMATION_DURATION: 300,

    // Zoom settings
    ZOOM_FACTOR: {
        IN: 1.2,
        OUT: 0.8,
        WHEEL: {
            IN: 0.9,
            OUT: 1.1
        }
    },

    // SVG settings
    DEFAULT_VIEWBOX_PADDING: 0.05, // 5% of bbox size

    // Development settings
    DEBUG: false,
    LOG_PERFORMANCE: false
};

// Error messages
export const ERROR_MESSAGES = {
    INIT_FAILED: 'Failed to initialize application. Please refresh the page.',
    VIZ_INIT_FAILED: 'Failed to initialize Graphviz engine. Please refresh the page.',
    RENDER_FAILED: 'Failed to render the graph. Please check your DOT syntax.',
    FILE_TOO_LARGE: `File is too large. Maximum size is ${CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`,
    INVALID_FILE_TYPE: `Please select a file with one of these extensions: ${CONFIG.SUPPORTED_EXTENSIONS.join(', ')}`,
    EMPTY_FILE: 'Selected file is empty',
    INVALID_DOT: 'The file does not appear to contain valid DOT syntax',
    NO_GRAPH_TO_DOWNLOAD: 'No graph to download. Please render a graph first.',
    DOWNLOAD_FAILED: 'Failed to download SVG'
};

// Success messages
export const SUCCESS_MESSAGES = {
    FILE_LOADED: 'loaded successfully',
    GRAPH_RENDERED: 'Graph rendered successfully',
    SVG_DOWNLOADED: 'SVG downloaded successfully'
};

// Utility functions
export const UTILS = {
    /**
     * Generate a filename with timestamp
     * @param {string} layout - Current layout engine
     * @param {string} extension - File extension
     * @returns {string} Generated filename
     */
    generateFilename(layout, extension = 'svg') {
        const timestamp = new Date().toISOString()
            .replace(/[:.]/g, '-')
            .slice(0, -5);
        return `graph-${layout}-${timestamp}.${extension}`;
    },

    /**
     * Validate viewBox array
     * @param {Array} viewBox - ViewBox array to validate
     * @returns {boolean} True if valid
     */
    isValidViewBox(viewBox) {
        return Array.isArray(viewBox) &&
            viewBox.length === 4 &&
            viewBox.every(val => typeof val === 'number' && !isNaN(val));
    },

    /**
     * Debounce function calls
     * @param {Function} func - Function to debounce
     * @param {number} wait - Delay in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Log performance metrics if enabled
     * @param {string} operation - Operation name
     * @param {number} startTime - Start time from performance.now()
     */
    logPerformance(operation, startTime) {
        if (CONFIG.LOG_PERFORMANCE) {
            const duration = performance.now() - startTime;
            console.log(`⏱️ ${operation}: ${duration.toFixed(2)}ms`);
        }
    }
};
