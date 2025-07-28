/**
 * URL工具函数
 * 提供URL解析相关功能
 */

/**
 * 从夸克网盘分享链接中提取pwd_id
 * @param {string} url - 分享链接
 * @returns {string} pwd_id或空字符串
 */
export function getIdFromUrl(url) {
    try {
        const pattern = /\/s\/(\w+)/;
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
        return '';
    } catch (error) {
        console.error('URL解析错误:', error);
        return '';
    }
}

/**
 * 验证URL格式是否正确
 * @param {string} url - 待验证的URL
 * @returns {boolean} 是否为有效的夸克网盘分享链接
 */
export function isValidQuarkUrl(url) {
    try {
        const pattern = /^https:\/\/pan\.quark\.cn\/s\/\w+/;
        return pattern.test(url);
    } catch (error) {
        console.error('URL验证错误:', error);
        return false;
    }
}

/**
 * 验证是否为有效的URL
 * @param {string} url - 待验证的URL
 * @returns {boolean} 是否为有效URL
 */
export function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * 解析URL参数
 * @param {string} url - URL字符串
 * @returns {Object} 参数对象
 */
export function parseUrlParams(url) {
    try {
        const urlObj = new URL(url);
        const params = {};
        
        for (const [key, value] of urlObj.searchParams) {
            params[key] = value;
        }
        
        return params;
    } catch (error) {
        console.error('URL参数解析错误:', error);
        return {};
    }
}

/**
 * 构建URL参数字符串
 * @param {Object} params - 参数对象
 * @returns {string} 参数字符串
 */
export function buildUrlParams(params) {
    try {
        const searchParams = new URLSearchParams();
        
        for (const [key, value] of Object.entries(params)) {
            if (value !== null && value !== undefined) {
                searchParams.append(key, String(value));
            }
        }
        
        return searchParams.toString();
    } catch (error) {
        console.error('URL参数构建错误:', error);
        return '';
    }
}

/**
 * 组合URL和参数
 * @param {string} baseUrl - 基础URL
 * @param {Object} params - 参数对象
 * @returns {string} 完整URL
 */
export function combineUrlWithParams(baseUrl, params) {
    try {
        const paramString = buildUrlParams(params);
        if (!paramString) {
            return baseUrl;
        }
        
        const separator = baseUrl.includes('?') ? '&' : '?';
        return `${baseUrl}${separator}${paramString}`;
    } catch (error) {
        console.error('URL组合错误:', error);
        return baseUrl;
    }
}

/**
 * 获取URL的域名
 * @param {string} url - URL字符串
 * @returns {string} 域名
 */
export function getDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (error) {
        console.error('域名提取错误:', error);
        return '';
    }
}

/**
 * 获取URL的协议
 * @param {string} url - URL字符串
 * @returns {string} 协议
 */
export function getProtocol(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.protocol;
    } catch (error) {
        console.error('协议提取错误:', error);
        return '';
    }
}

/**
 * 获取URL的路径
 * @param {string} url - URL字符串
 * @returns {string} 路径
 */
export function getPath(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.pathname;
    } catch (error) {
        console.error('路径提取错误:', error);
        return '';
    }
}

/**
 * 检查URL是否为HTTPS
 * @param {string} url - URL字符串
 * @returns {boolean} 是否为HTTPS
 */
export function isHttps(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'https:';
    } catch (error) {
        return false;
    }
}

/**
 * 标准化URL（移除末尾斜杠等）
 * @param {string} url - URL字符串
 * @returns {string} 标准化后的URL
 */
export function normalizeUrl(url) {
    try {
        const urlObj = new URL(url);
        
        // 移除末尾斜杠（除非是根路径）
        if (urlObj.pathname !== '/' && urlObj.pathname.endsWith('/')) {
            urlObj.pathname = urlObj.pathname.slice(0, -1);
        }
        
        return urlObj.toString();
    } catch (error) {
        console.error('URL标准化错误:', error);
        return url;
    }
}

/**
 * 检查两个URL是否相同（忽略参数顺序）
 * @param {string} url1 - URL1
 * @param {string} url2 - URL2
 * @returns {boolean} 是否相同
 */
export function isSameUrl(url1, url2) {
    try {
        const urlObj1 = new URL(url1);
        const urlObj2 = new URL(url2);
        
        // 比较基础部分
        if (urlObj1.origin !== urlObj2.origin || urlObj1.pathname !== urlObj2.pathname) {
            return false;
        }
        
        // 比较参数
        const params1 = Array.from(urlObj1.searchParams.entries()).sort();
        const params2 = Array.from(urlObj2.searchParams.entries()).sort();
        
        return JSON.stringify(params1) === JSON.stringify(params2);
    } catch (error) {
        return false;
    }
}

/**
 * 从URL中移除指定参数
 * @param {string} url - URL字符串
 * @param {Array<string>} paramsToRemove - 要移除的参数名数组
 * @returns {string} 处理后的URL
 */
export function removeUrlParams(url, paramsToRemove) {
    try {
        const urlObj = new URL(url);
        
        paramsToRemove.forEach(param => {
            urlObj.searchParams.delete(param);
        });
        
        return urlObj.toString();
    } catch (error) {
        console.error('URL参数移除错误:', error);
        return url;
    }
}

/**
 * 向URL添加或更新参数
 * @param {string} url - URL字符串
 * @param {Object} paramsToAdd - 要添加的参数对象
 * @returns {string} 处理后的URL
 */
export function addUrlParams(url, paramsToAdd) {
    try {
        const urlObj = new URL(url);
        
        for (const [key, value] of Object.entries(paramsToAdd)) {
            if (value !== null && value !== undefined) {
                urlObj.searchParams.set(key, String(value));
            }
        }
        
        return urlObj.toString();
    } catch (error) {
        console.error('URL参数添加错误:', error);
        return url;
    }
}

/**
 * 获取文件扩展名从URL
 * @param {string} url - URL字符串
 * @returns {string} 文件扩展名
 */
export function getFileExtensionFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const lastDotIndex = pathname.lastIndexOf('.');
        
        if (lastDotIndex > 0 && lastDotIndex < pathname.length - 1) {
            return pathname.substring(lastDotIndex + 1).toLowerCase();
        }
        
        return '';
    } catch (error) {
        console.error('文件扩展名提取错误:', error);
        return '';
    }
}

/**
 * 获取文件名从URL
 * @param {string} url - URL字符串
 * @returns {string} 文件名
 */
export function getFileNameFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const lastSlashIndex = pathname.lastIndexOf('/');
        
        if (lastSlashIndex >= 0 && lastSlashIndex < pathname.length - 1) {
            return pathname.substring(lastSlashIndex + 1);
        }
        
        return '';
    } catch (error) {
        console.error('文件名提取错误:', error);
        return '';
    }
}

/**
 * 检查URL是否指向图片
 * @param {string} url - URL字符串
 * @returns {boolean} 是否为图片URL
 */
export function isImageUrl(url) {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
    const extension = getFileExtensionFromUrl(url);
    return imageExtensions.includes(extension);
}

/**
 * 检查URL是否指向视频
 * @param {string} url - URL字符串
 * @returns {boolean} 是否为视频URL
 */
export function isVideoUrl(url) {
    const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'];
    const extension = getFileExtensionFromUrl(url);
    return videoExtensions.includes(extension);
}

/**
 * 检查URL是否指向音频
 * @param {string} url - URL字符串
 * @returns {boolean} 是否为音频URL
 */
export function isAudioUrl(url) {
    const audioExtensions = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'];
    const extension = getFileExtensionFromUrl(url);
    return audioExtensions.includes(extension);
}

export default {
    getIdFromUrl,
    isValidQuarkUrl,
    isValidUrl,
    parseUrlParams,
    buildUrlParams,
    combineUrlWithParams,
    getDomain,
    getProtocol,
    getPath,
    isHttps,
    normalizeUrl,
    isSameUrl,
    removeUrlParams,
    addUrlParams,
    getFileExtensionFromUrl,
    getFileNameFromUrl,
    isImageUrl,
    isVideoUrl,
    isAudioUrl
};
