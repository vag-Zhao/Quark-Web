import { formatTimestamp } from './timeUtils.js';

export class Logger {
    constructor(options = {}) {
        this.level = options.level || 'info';
        this.maxLogs = options.maxLogs || 1000;
        this.enableConsole = options.enableConsole !== false;
        this.enableUI = options.enableUI !== false;
        this.logs = [];

        this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
        this.levelNames = ['error', 'warn', 'info', 'debug'];

        if (this.enableUI) {
            this.initUILogger();
        }
    }

    initUILogger() {
        this.logContainer = document.getElementById('logsContent');

        const clearBtn = document.getElementById('clearLogsBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearLogs());
        }
    }

    shouldLog(level) {
        return this.levels[level] <= this.levels[this.level];
    }

    log(level, message, data = null) {
        if (!this.shouldLog(level)) return;

        const timestamp = Date.now();
        const logEntry = {
            timestamp,
            level,
            message,
            data,
            formattedTime: formatTimestamp(timestamp)
        };

        this.logs.push(logEntry);

        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        if (this.enableConsole) {
            this.logToConsole(logEntry);
        }

        if (this.enableUI) {
            this.logToUI(logEntry);
        }

        this.dispatchLogEvent(logEntry);
    }

    logToConsole(logEntry) {
        const { level, message, data, formattedTime } = logEntry;
        const prefix = `[${formattedTime}] [${level.toUpperCase()}]`;

        const consoleMethods = {
            error: console.error,
            warn: console.warn,
            info: console.info,
            debug: console.debug
        };

        (consoleMethods[level] || console.log)(prefix, message, data || '');
    }

    logToUI(logEntry) {
        if (!this.logContainer) return;

        const { level, message, formattedTime } = logEntry;

        const logElement = document.createElement('div');
        logElement.className = `quark-gui-log-item quark-gui-log-${level}`;
        logElement.innerHTML = `
            <span class="quark-gui-log-time">${formattedTime}</span>
            <span class="quark-gui-log-message">${this.escapeHtml(message)}</span>
        `;

        this.logContainer.insertBefore(logElement, this.logContainer.firstChild);

        const logItems = this.logContainer.querySelectorAll('.quark-gui-log-item');
        if (logItems.length > 100) {
            logItems[logItems.length - 1].remove();
        }

        this.logContainer.scrollTop = 0;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    dispatchLogEvent(logEntry) {
        document.dispatchEvent(new CustomEvent('quark-log', { detail: logEntry }));
    }

    error(message, data) {
        this.log('error', message, data);
    }

    warn(message, data) {
        this.log('warn', message, data);
    }

    info(message, data) {
        this.log('info', message, data);
    }

    debug(message, data) {
        this.log('debug', message, data);
    }

    clearLogs() {
        this.logs = [];

        if (this.logContainer) {
            this.logContainer.innerHTML = '';
        }

        this.info('日志已清空');
    }

    getLogs(options = {}) {
        let logs = [...this.logs];

        if (options.level) {
            logs = logs.filter(log => log.level === options.level);
        }

        if (options.startTime) {
            logs = logs.filter(log => log.timestamp >= options.startTime);
        }

        if (options.endTime) {
            logs = logs.filter(log => log.timestamp <= options.endTime);
        }

        if (options.keyword) {
            const keyword = options.keyword.toLowerCase();
            logs = logs.filter(log =>
                log.message.toLowerCase().includes(keyword)
            );
        }

        if (options.limit) {
            logs = logs.slice(-options.limit);
        }

        return logs;
    }

    exportLogs(options = {}) {
        const logs = this.getLogs(options);
        const format = options.format || 'text';

        if (format === 'json') {
            return JSON.stringify(logs, null, 2);
        }

        return logs.map(log =>
            `[${log.formattedTime}] [${log.level.toUpperCase()}] ${log.message}`
        ).join('\n');
    }

    downloadLogs(options = {}) {
        const content = this.exportLogs(options);
        const format = options.format || 'text';
        const extension = format === 'json' ? 'json' : 'txt';
        const filename = options.filename || `quark-logs-${formatTimestamp(Date.now(), 'YYYY-MM-DD-HH-mm-ss')}.${extension}`;

        const blob = new Blob([content], {
            type: format === 'json' ? 'application/json' : 'text/plain'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.info(`日志已导出: ${filename}`);
    }

    setLevel(level) {
        if (this.levels.hasOwnProperty(level)) {
            this.level = level;
            this.info(`日志级别已设置为: ${level}`);
        } else {
            this.warn(`无效的日志级别: ${level}`);
        }
    }

    getStatistics() {
        const stats = {
            total: this.logs.length,
            byLevel: {},
            byHour: {},
            recentErrors: []
        };

        this.levelNames.forEach(level => {
            stats.byLevel[level] = 0;
        });

        const recentTime = Date.now() - 24 * 60 * 60 * 1000;

        this.logs.forEach(log => {
            stats.byLevel[log.level]++;

            const hour = new Date(log.timestamp).getHours();
            stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;

            if (log.level === 'error' && log.timestamp > recentTime) {
                stats.recentErrors.push(log);
            }
        });

        return stats;
    }

    onLog(callback) {
        document.addEventListener('quark-log', (event) => {
            callback(event.detail);
        });
    }
}

export default Logger;
