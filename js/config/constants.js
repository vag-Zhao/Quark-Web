/**
 * 应用常量配置
 * 定义应用中使用的常量
 */

// 应用信息
export const APP_INFO = {
    name: '夸克网盘转存工具',
    version: '1.0.0',
    description: '基于纯Web技术构建的夸克网盘文件转存工具',
    author: 'Quark Transfer Tool Team',
    homepage: 'https://github.com/quark-transfer-tool',
    license: 'MIT'
};

// API配置
export const API_CONFIG = {
    baseUrl: 'https://drive-pc.quark.cn',
    timeout: 30000,
    retryCount: 3,
    retryDelay: 1000,
    endpoints: {
        token: '/1/clouddrive/share/sharepage/token',
        detail: '/1/clouddrive/share/sharepage/detail',
        save: '/1/clouddrive/share/sharepage/save',
        task: '/1/clouddrive/task',
        share: '/1/clouddrive/share',
        sharePassword: '/1/clouddrive/share/password',
        fileSort: '/1/clouddrive/file/sort',
        fileSearch: '/1/clouddrive/file/search',
        fileDelete: '/1/clouddrive/file/delete'
    }
};

// 请求头配置
export const REQUEST_HEADERS = {
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'accept': 'application/json, text/plain, */*',
    'content-type': 'application/json',
    'sec-ch-ua-mobile': '?0',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'sec-ch-ua-platform': '"Windows"',
    'origin': 'https://pan.quark.cn',
    'sec-fetch-site': 'same-site',
    'sec-fetch-mode': 'cors',
    'sec-fetch-dest': 'empty',
    'referer': 'https://pan.quark.cn/',
    'accept-encoding': 'gzip, deflate, br',
    'accept-language': 'zh-CN,zh;q=0.9'
};

// 数据库配置
export const DB_CONFIG = {
    name: 'QuarkGUI',
    version: 1,
    storeName: 'files',
    indexes: [
        { name: 'fileName', keyPath: 'fileName', unique: false },
        { name: 'fileType', keyPath: 'fileType', unique: false },
        { name: 'createTime', keyPath: 'createTime', unique: false }
    ]
};

// 本地存储键名
export const STORAGE_KEYS = {
    settings: 'quark-gui-settings',
    lastUsedCookie: 'quark-gui-last-cookie',
    userPreferences: 'quark-gui-preferences',
    cacheData: 'quark-gui-cache'
};

// 文件类型配置
export const FILE_TYPES = {
    video: {
        extensions: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v', '3gp'],
        icon: '🎬',
        color: '#ff6b6b'
    },
    audio: {
        extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'],
        icon: '🎵',
        color: '#4ecdc4'
    },
    image: {
        extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'],
        icon: '🖼️',
        color: '#45b7d1'
    },
    document: {
        extensions: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'],
        icon: '📄',
        color: '#96ceb4'
    },
    spreadsheet: {
        extensions: ['xls', 'xlsx', 'csv', 'ods'],
        icon: '📊',
        color: '#feca57'
    },
    presentation: {
        extensions: ['ppt', 'pptx', 'odp'],
        icon: '📽️',
        color: '#ff9ff3'
    },
    archive: {
        extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'],
        icon: '📦',
        color: '#a55eea'
    },
    code: {
        extensions: ['js', 'html', 'css', 'py', 'java', 'cpp', 'c', 'php', 'json', 'xml'],
        icon: '💻',
        color: '#26de81'
    },
    default: {
        icon: '📁',
        color: '#778ca3'
    }
};

// 分页配置
export const PAGINATION_CONFIG = {
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50, 100],
    maxVisiblePages: 5
};

// 通知配置
export const NOTIFICATION_CONFIG = {
    defaultDuration: 3000, // 3秒后自动消失
    maxNotifications: 5,
    position: 'top-right',
    types: {
        success: { icon: '✅', color: '#52c41a' },
        warning: { icon: '⚠️', color: '#faad14' },
        error: { icon: '❌', color: '#ff4d4f' },
        info: { icon: 'ℹ️', color: '#1890ff' }
    }
};

// 日志配置
export const LOG_CONFIG = {
    level: 'info',
    maxLogs: 1000,
    enableConsole: true,
    enableUI: true,
    levels: {
        error: 0,
        warn: 1,
        info: 2,
        debug: 3
    }
};

// 验证规则
export const VALIDATION_RULES = {
    url: {
        quarkShare: /^https:\/\/pan\.quark\.cn\/s\/\w+/,
        general: /^https?:\/\/.+/
    },
    fileName: {
        maxLength: 255,
        invalidChars: /[<>:"/\\|?*]/
    },
    cookie: {
        minLength: 50,
        required: ['__kp', '__kps', '__ktd', '__uid']
    }
};

// 错误消息
export const ERROR_MESSAGES = {
    network: {
        timeout: '请求超时，请检查网络连接',
        offline: '网络连接已断开',
        serverError: '服务器错误，请稍后重试'
    },
    validation: {
        invalidUrl: '请输入有效的夸克网盘分享链接',
        emptyCookie: 'Cookie不能为空',
        invalidCookie: 'Cookie格式无效',
        emptyFileName: '文件名不能为空'
    },
    database: {
        connectionFailed: '数据库连接失败',
        operationFailed: '数据库操作失败',
        dataCorrupted: '数据已损坏'
    },
    transfer: {
        failed: '文件转存失败',
        duplicateFile: '文件已存在',
        invalidShare: '分享链接无效或已过期',
        quotaExceeded: '存储空间不足'
    }
};

// 成功消息
export const SUCCESS_MESSAGES = {
    transfer: {
        completed: '文件转存成功',
        linkGenerated: '分享链接已生成'
    },
    settings: {
        saved: '设置已保存',
        cookieValid: 'Cookie验证成功'
    },
    data: {
        exported: '数据导出成功',
        imported: '数据导入成功',
        cleared: '数据清空成功'
    }
};

// 默认设置
export const DEFAULT_SETTINGS = {
    defaultCookie: '',
    autoSaveEnabled: true,
    duplicateCheckEnabled: true,
    requestTimeout: 30,
    theme: 'light',
    language: 'zh-CN',
    pageSize: 20,
    enableNotifications: true,
    enableSounds: false,
    autoRefresh: false,
    refreshInterval: 30
};

// 主题配置
export const THEME_CONFIG = {
    light: {
        name: '浅色主题',
        primary: '#1890ff',
        background: '#ffffff',
        surface: '#fafafa',
        text: '#262626'
    },
    dark: {
        name: '深色主题',
        primary: '#1890ff',
        background: '#1f1f1f',
        surface: '#262626',
        text: '#ffffff'
    }
};

// 语言配置
export const LANGUAGE_CONFIG = {
    'zh-CN': {
        name: '简体中文',
        flag: '🇨🇳'
    },
    'en-US': {
        name: 'English',
        flag: '🇺🇸'
    }
};

// 快捷键配置
export const KEYBOARD_SHORTCUTS = {
    'Ctrl+S': 'saveSettings',
    'Ctrl+R': 'refreshFileList',
    'Ctrl+N': 'newTransfer',
    'Ctrl+E': 'exportData',
    'Ctrl+I': 'importData',
    'Escape': 'closeModal',
    'F5': 'refresh'
};

// 性能配置
export const PERFORMANCE_CONFIG = {
    virtualScrollThreshold: 100,
    debounceDelay: 300,
    throttleDelay: 100,
    cacheTimeout: 5 * 60 * 1000, // 5分钟
    maxCacheSize: 100
};

// 安全配置
export const SECURITY_CONFIG = {
    cookieEncryption: true,
    dataValidation: true,
    xssProtection: true,
    csrfProtection: false // Web应用不需要CSRF保护
};

// 导出所有配置
export default {
    APP_INFO,
    API_CONFIG,
    REQUEST_HEADERS,
    DB_CONFIG,
    STORAGE_KEYS,
    FILE_TYPES,
    PAGINATION_CONFIG,
    NOTIFICATION_CONFIG,
    LOG_CONFIG,
    VALIDATION_RULES,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    DEFAULT_SETTINGS,
    THEME_CONFIG,
    LANGUAGE_CONFIG,
    KEYBOARD_SHORTCUTS,
    PERFORMANCE_CONFIG,
    SECURITY_CONFIG
};
