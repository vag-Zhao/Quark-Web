/**
 * 时间工具函数
 * 提供时间戳生成等功能
 */

/**
 * 生成指定长度的时间戳
 * 与Node.js版本的generate_timestamp函数保持一致
 * @param {number} length - 时间戳长度
 * @returns {number} 指定长度的时间戳
 */
export function generateTimestamp(length) {
    try {
        const timestamps = String(Date.now());
        return parseInt(timestamps.substring(0, length));
    } catch (error) {
        console.error('时间戳生成错误:', error);
        return parseInt(String(Date.now()).substring(0, length));
    }
}

/**
 * 生成随机延迟时间（毫秒）
 * 用于模拟真实用户行为
 * @param {number} min - 最小延迟（秒）
 * @param {number} max - 最大延迟（秒）
 * @returns {number} 随机延迟时间（毫秒）
 */
export function generateRandomDelay(min = 1, max = 5) {
    try {
        return Math.floor((Math.random() * (max - min) + min) * 60 * 1000);
    } catch (error) {
        console.error('随机延迟生成错误:', error);
        return 60000; // 默认1分钟
    }
}

/**
 * 获取当前时间戳（13位）
 * @returns {number} 13位时间戳
 */
export function getCurrentTimestamp() {
    return Date.now();
}

/**
 * 格式化时间戳为可读字符串
 * @param {number} timestamp - 时间戳
 * @param {string} format - 格式字符串
 * @returns {string} 格式化后的时间字符串
 */
export function formatTimestamp(timestamp, format = 'YYYY-MM-DD HH:mm:ss') {
    const date = new Date(timestamp);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
}

/**
 * 获取相对时间描述
 * @param {number} timestamp - 时间戳
 * @returns {string} 相对时间描述
 */
export function getRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;
    const month = 30 * day;
    const year = 365 * day;
    
    if (diff < minute) {
        return '刚刚';
    } else if (diff < hour) {
        return `${Math.floor(diff / minute)}分钟前`;
    } else if (diff < day) {
        return `${Math.floor(diff / hour)}小时前`;
    } else if (diff < week) {
        return `${Math.floor(diff / day)}天前`;
    } else if (diff < month) {
        return `${Math.floor(diff / week)}周前`;
    } else if (diff < year) {
        return `${Math.floor(diff / month)}个月前`;
    } else {
        return `${Math.floor(diff / year)}年前`;
    }
}

/**
 * 计算时间差
 * @param {number} startTime - 开始时间戳
 * @param {number} endTime - 结束时间戳
 * @returns {Object} 时间差对象
 */
export function getTimeDifference(startTime, endTime = Date.now()) {
    const diff = Math.abs(endTime - startTime);
    
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((diff % (60 * 1000)) / 1000);
    
    return { days, hours, minutes, seconds, total: diff };
}

/**
 * 延迟执行函数
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise} Promise对象
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 节流函数
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 限制时间
 * @returns {Function} 节流后的函数
 */
export function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * 获取今天的开始时间戳
 * @returns {number} 今天开始的时间戳
 */
export function getTodayStart() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.getTime();
}

/**
 * 获取今天的结束时间戳
 * @returns {number} 今天结束的时间戳
 */
export function getTodayEnd() {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return today.getTime();
}

/**
 * 获取本周的开始时间戳
 * @returns {number} 本周开始的时间戳
 */
export function getWeekStart() {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // 调整为周一开始
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday.getTime();
}

/**
 * 获取本月的开始时间戳
 * @returns {number} 本月开始的时间戳
 */
export function getMonthStart() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    firstDay.setHours(0, 0, 0, 0);
    return firstDay.getTime();
}

/**
 * 检查是否为同一天
 * @param {number} timestamp1 - 时间戳1
 * @param {number} timestamp2 - 时间戳2
 * @returns {boolean} 是否为同一天
 */
export function isSameDay(timestamp1, timestamp2) {
    const date1 = new Date(timestamp1);
    const date2 = new Date(timestamp2);
    
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

/**
 * 获取时间范围描述
 * @param {number} startTime - 开始时间
 * @param {number} endTime - 结束时间
 * @returns {string} 时间范围描述
 */
export function getTimeRangeDescription(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (isSameDay(startTime, endTime)) {
        return formatTimestamp(startTime, 'YYYY-MM-DD');
    } else {
        return `${formatTimestamp(startTime, 'YYYY-MM-DD')} 至 ${formatTimestamp(endTime, 'YYYY-MM-DD')}`;
    }
}

export default {
    generateTimestamp,
    generateRandomDelay,
    getCurrentTimestamp,
    formatTimestamp,
    getRelativeTime,
    getTimeDifference,
    delay,
    debounce,
    throttle,
    getTodayStart,
    getTodayEnd,
    getWeekStart,
    getMonthStart,
    isSameDay,
    getTimeRangeDescription
};
