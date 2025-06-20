// Notification system with improved performance and accessibility
export class NotificationManager {
    constructor() {
        this.notificationQueue = [];
        this.maxNotifications = 5;
        this.animationDuration = 300;
    }

    showMessage(message, type = 'info') {
        // Prevent duplicate notifications
        if (this.isDuplicateMessage(message, type)) {
            return;
        }

        const container = this.getOrCreateNotificationContainer();
        const notification = this.createNotification(message, type);

        // Limit the number of notifications
        this.limitNotifications(container);

        container.appendChild(notification);
        this.notificationQueue.push({ notification, type, message });

        this.showNotification(notification);
        this.scheduleNotificationRemoval(notification, container, type);
    }

    isDuplicateMessage(message, type) {
        return this.notificationQueue.some(item =>
            item.message === message && item.type === type
        );
    }

    limitNotifications(container) {
        while (container.children.length >= this.maxNotifications) {
            const oldestNotification = container.firstChild;
            this.removeNotification(oldestNotification, container);
        }
    }

    getOrCreateNotificationContainer() {
        let container = document.querySelector('.notification-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        return container;
    }

    createNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.setAttribute('role', 'alert');
        notification.setAttribute('aria-live', 'polite');

        // Create content structure
        const content = document.createElement('span');
        content.className = 'notification-content';
        content.textContent = message;

        const closeButton = document.createElement('button');
        closeButton.className = 'notification-close';
        closeButton.innerHTML = '×';
        closeButton.setAttribute('aria-label', 'Close notification');
        closeButton.addEventListener('click', () => {
            this.removeNotification(notification, notification.parentNode);
        });

        notification.appendChild(content);
        notification.appendChild(closeButton);

        return notification;
    }

    showNotification(notification) {
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
    }

    scheduleNotificationRemoval(notification, container, type) {
        const removeNotification = () => {
            this.removeNotification(notification, container);
        };

        const displayTime = this.getDisplayTime(type);
        setTimeout(removeNotification, displayTime);

        // Remove on click
        notification.addEventListener('click', removeNotification);
    }

    removeNotification(notification, container) {
        if (!notification || !notification.parentNode) {
            return;
        }

        // Remove from queue
        this.notificationQueue = this.notificationQueue.filter(item =>
            item.notification !== notification
        );

        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
            if (container && container.children.length === 0) {
                container.remove();
            }
        }, this.animationDuration);
    }

    getDisplayTime(type) {
        const times = {
            'error': 6000,
            'warning': 4000,
            'info': 3000,
            'success': 3000
        };
        return times[type] || 3000;
    }
}
