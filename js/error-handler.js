// Error handling and logging utilities
import { CONFIG } from './config.js';

export class ErrorHandler {
    constructor(notificationManager) {
        this.notificationManager = notificationManager;
        this.errorCount = 0;
        this.maxErrors = 10;
        this.errorLog = [];

        // Set up global error handlers
        this.setupGlobalErrorHandlers();
    }

    setupGlobalErrorHandlers() {
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.handleError(event.reason, 'Unhandled Promise Rejection');
            event.preventDefault();
        });

        // Handle general JavaScript errors
        window.addEventListener('error', (event) => {
            console.error('JavaScript error:', event.error);
            this.handleError(event.error, 'JavaScript Error');
        });
    }

    handleError(error, context = 'Unknown') {
        this.errorCount++;

        const errorInfo = {
            timestamp: new Date().toISOString(),
            context,
            message: error?.message || String(error),
            stack: error?.stack,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        this.errorLog.push(errorInfo);

        // Limit error log size
        if (this.errorLog.length > 50) {
            this.errorLog = this.errorLog.slice(-25);
        }

        if (CONFIG.DEBUG) {
            console.group(`🚨 Error #${this.errorCount} - ${context}`);
            console.error('Error object:', error);
            console.log('Error info:', errorInfo);
            console.groupEnd();
        }

        // Show user-friendly error message
        if (this.notificationManager && this.errorCount <= this.maxErrors) {
            this.notificationManager.showMessage(
                this.getUserFriendlyMessage(error, context),
                'error'
            );
        }

        // If too many errors, suggest page refresh
        if (this.errorCount > this.maxErrors) {
            this.notificationManager.showMessage(
                'Multiple errors detected. Please refresh the page.',
                'error'
            );
        }

        return errorInfo;
    }

    getUserFriendlyMessage(error, context) {
        const message = error?.message || String(error);

        // Common error patterns and user-friendly messages
        const errorPatterns = [
            {
                pattern: /network|fetch|cors/i,
                message: 'Network error. Please check your internet connection.'
            },
            {
                pattern: /syntax|parse/i,
                message: 'There appears to be a syntax error in your DOT code.'
            },
            {
                pattern: /memory|quota/i,
                message: 'Out of memory. Try simplifying your graph.'
            },
            {
                pattern: /permission|security/i,
                message: 'Permission denied. Please check your browser settings.'
            }
        ];

        for (const { pattern, message: friendlyMessage } of errorPatterns) {
            if (pattern.test(message)) {
                return friendlyMessage;
            }
        }

        // Fallback to generic message
        return `An error occurred${context !== 'Unknown' ? ` in ${context}` : ''}. Please try again.`;
    }

    // Performance monitoring
    measurePerformance(name, fn) {
        if (!CONFIG.LOG_PERFORMANCE) {
            return fn();
        }

        const startTime = performance.now();
        const startMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

        try {
            const result = fn();

            if (result instanceof Promise) {
                return result.finally(() => {
                    this.logPerformanceMetrics(name, startTime, startMemory);
                });
            } else {
                this.logPerformanceMetrics(name, startTime, startMemory);
                return result;
            }
        } catch (error) {
            this.logPerformanceMetrics(name, startTime, startMemory, error);
            throw error;
        }
    }

    logPerformanceMetrics(name, startTime, startMemory, error = null) {
        const duration = performance.now() - startTime;
        const memoryUsed = performance.memory ?
            (performance.memory.usedJSHeapSize - startMemory) / 1024 / 1024 : 0;

        console.group(`📊 Performance: ${name}`);
        console.log(`Duration: ${duration.toFixed(2)}ms`);
        if (performance.memory) {
            console.log(`Memory used: ${memoryUsed.toFixed(2)}MB`);
        }
        if (error) {
            console.error('Error occurred:', error);
        }
        console.groupEnd();
    }

    // Get error statistics for debugging
    getErrorStats() {
        return {
            totalErrors: this.errorCount,
            recentErrors: this.errorLog.slice(-10),
            errorsByContext: this.errorLog.reduce((acc, error) => {
                acc[error.context] = (acc[error.context] || 0) + 1;
                return acc;
            }, {})
        };
    }

    // Clear error log
    clearErrorLog() {
        this.errorLog = [];
        this.errorCount = 0;
    }

    // Export error log for debugging
    exportErrorLog() {
        const data = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            stats: this.getErrorStats(),
            errors: this.errorLog
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `error-log-${new Date().toISOString().slice(0, 19)}.json`;
        link.click();

        URL.revokeObjectURL(url);
    }
}
