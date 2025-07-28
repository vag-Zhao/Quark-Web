export class NotificationManager {
    constructor(options = {}) {
        this.container = null;
        this.notifications = new Map();
        this.defaultDuration = options.defaultDuration || 1500;
        this.maxNotifications = options.maxNotifications || 5;
        this.position = options.position || 'top-right';

        this.init();
    }

    init() {
        this.createContainer();
        this.bindEvents();
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.className = 'quark-gui-notification-container';
        this.container.style.cssText = `
            position: fixed;
            z-index: 10000;
            pointer-events: none;
            ${this.getPositionStyles()}
        `;

        document.body.appendChild(this.container);
    }

    getPositionStyles() {
        const positions = {
            'top-left': 'top: 20px; left: 20px;',
            'top-right': 'top: 20px; right: 20px;',
            'bottom-left': 'bottom: 20px; left: 20px;',
            'bottom-right': 'bottom: 20px; right: 20px;',
            'top-center': 'top: 20px; left: 50%; transform: translateX(-50%);',
            'bottom-center': 'bottom: 20px; left: 50%; transform: translateX(-50%);'
        };

        return positions[this.position] || positions['top-right'];
    }

    bindEvents() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.clearAll();
            }
        });
    }

    show(type, title, message, options = {}) {
        const id = this.generateId();
        const duration = options.duration !== undefined ? options.duration : this.defaultDuration;
        const persistent = options.persistent || false;
        const actions = options.actions || [];

        if (this.notifications.size >= this.maxNotifications) {
            const firstId = this.notifications.keys().next().value;
            this.remove(firstId);
        }

        const notification = this.createNotification(id, type, title, message, {
            duration,
            persistent,
            actions,
            onClick: options.onClick,
            onClose: options.onClose
        });

        this.notifications.set(id, notification);
        this.container.appendChild(notification.element);

        setTimeout(() => {
            notification.element.classList.add('show');
        }, 10);

        if (!persistent && duration > 0) {
            notification.timer = setTimeout(() => {
                this.remove(id);
            }, duration);
        }

        this.dispatchEvent('show', { id, type, title, message });

        return id;
    }

    createNotification(id, type, title, message, options) {
        const element = document.createElement('div');
        element.className = `quark-gui-notification ${type}`;
        element.style.cssText = `
            pointer-events: auto;
            margin-bottom: 10px;
        `;

        const iconMap = {
            success: '✅',
            warning: '⚠️',
            error: '❌',
            info: 'ℹ️'
        };

        const icon = iconMap[type] || 'ℹ️';

        element.innerHTML = `
            <div class="quark-gui-notification-header">
                <div class="quark-gui-notification-title">
                    <span class="quark-gui-notification-icon">${icon}</span>
                    ${this.escapeHtml(title)}
                </div>
                <button class="quark-gui-notification-close" data-id="${id}">&times;</button>
            </div>
            <div class="quark-gui-notification-content">
                ${this.escapeHtml(message)}
            </div>
            ${options.actions.length > 0 ? this.createActionsHtml(options.actions, id) : ''}
        `;

        this.bindNotificationEvents(element, id, options);

        return {
            id,
            type,
            title,
            message,
            element,
            timer: null,
            options
        };
    }

    createActionsHtml(actions, notificationId) {
        const actionsHtml = actions.map((action, index) => `
            <button class="quark-gui-btn quark-gui-btn-small"
                    data-notification-id="${notificationId}"
                    data-action-index="${index}">
                ${this.escapeHtml(action.text)}
            </button>
        `).join('');

        return `
            <div class="quark-gui-notification-actions">
                ${actionsHtml}
            </div>
        `;
    }

    bindNotificationEvents(element, id, options) {
        const closeBtn = element.querySelector('.quark-gui-notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.remove(id);
            });
        }

        if (options.onClick) {
            element.addEventListener('click', (e) => {
                if (!e.target.closest('.quark-gui-notification-close') &&
                    !e.target.closest('.quark-gui-notification-actions')) {
                    options.onClick(id);
                }
            });
        }

        const actionButtons = element.querySelectorAll('[data-action-index]');
        actionButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const actionIndex = parseInt(e.target.dataset.actionIndex);
                const action = options.actions[actionIndex];
                if (action?.handler) {
                    action.handler(id);
                }

                if (action?.closeOnClick !== false) {
                    this.remove(id);
                }
            });
        });

        element.addEventListener('mouseenter', () => {
            const notification = this.notifications.get(id);
            if (notification?.timer) {
                clearTimeout(notification.timer);
                notification.timer = null;
            }
        });

        element.addEventListener('mouseleave', () => {
            const notification = this.notifications.get(id);
            if (notification && !notification.options.persistent && notification.options.duration > 0) {
                notification.timer = setTimeout(() => {
                    this.remove(id);
                }, 2000);
            }
        });
    }

    remove(id) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        if (notification.timer) {
            clearTimeout(notification.timer);
        }

        if (notification.options.onClose) {
            notification.options.onClose(id);
        }

        notification.element.style.transform = 'translateX(100%)';
        notification.element.style.opacity = '0';

        setTimeout(() => {
            if (notification.element.parentNode) {
                notification.element.parentNode.removeChild(notification.element);
            }
            this.notifications.delete(id);
        }, 400);

        this.dispatchEvent('remove', { id });
    }

    clearAll() {
        const ids = Array.from(this.notifications.keys());
        ids.forEach(id => this.remove(id));
    }

    success(title, message, options = {}) {
        return this.show('success', title, message, options);
    }

    warning(title, message, options = {}) {
        return this.show('warning', title, message, options);
    }

    error(title, message, options = {}) {
        return this.show('error', title, message, {
            duration: 0,
            ...options
        });
    }

    info(title, message, options = {}) {
        return this.show('info', title, message, options);
    }

    generateId() {
        return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    dispatchEvent(eventName, detail) {
        document.dispatchEvent(new CustomEvent(`quark-notification-${eventName}`, { detail }));
    }

    on(eventName, callback) {
        document.addEventListener(`quark-notification-${eventName}`, (event) => {
            callback(event.detail);
        });
    }

    getCount() {
        return this.notifications.size;
    }

    hasType(type) {
        for (const notification of this.notifications.values()) {
            if (notification.type === type) {
                return true;
            }
        }
        return false;
    }

    destroy() {
        this.clearAll();
        if (this.container?.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.notifications.clear();
    }
}

// 添加CSS样式
const style = document.createElement('style');
style.textContent = `
    .quark-gui-notification-container {
        position: fixed;
        z-index: 10000;
        pointer-events: none;
    }

    .quark-gui-notification-actions {
        margin-top: 12px;
        display: flex;
        gap: 8px;
        justify-content: flex-end;
    }

    .quark-gui-notification-icon {
        margin-right: 8px;
        font-size: 16px;
    }

    .quark-gui-notification-title {
        display: flex;
        align-items: center;
        font-weight: 600;
        color: var(--quark-text-primary);
        font-size: var(--quark-font-size-base);
    }

    .quark-gui-notification-content {
        color: var(--quark-text-secondary);
        font-size: var(--quark-font-size-sm);
        line-height: 1.4;
        margin-top: 4px;
    }

    .quark-gui-notification-close {
        background: none;
        border: none;
        color: var(--quark-text-secondary);
        cursor: pointer;
        padding: 4px;
        border-radius: var(--quark-border-radius);
        font-size: 18px;
        line-height: 1;
        transition: all 0.2s ease;
    }

    .quark-gui-notification-close:hover {
        background: var(--quark-bg-hover);
        color: var(--quark-text-primary);
    }
`;
document.head.appendChild(style);

export default NotificationManager;
