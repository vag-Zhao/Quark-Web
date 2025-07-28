/**
 * 搜索服务类
 * 负责处理资源搜索相关的API调用
 */

export default class SearchService {
    constructor(logger, options = {}) {
        this.logger = logger;
        this.baseUrl = options.baseUrl || 'http://localhost:8081';
        this.timeout = options.timeout || 30000;
    }

    /**
     * 搜索资源
     * @param {Object} searchParams - 搜索参数
     * @param {string} searchParams.q - 搜索关键词
     * @param {number} searchParams.page - 页码
     * @param {number} searchParams.size - 每页数量
     * @param {string} searchParams.time - 时间范围
     * @param {string} searchParams.type - 资源类型
     * @param {boolean} searchParams.exact - 是否精确搜索
     * @returns {Promise<Object>} 搜索结果
     */
    async search(searchParams) {
        try {
            this.logger.info('开始搜索资源:', searchParams);

            // 验证必需参数
            if (!searchParams.q || !searchParams.q.trim()) {
                throw new Error('搜索关键词不能为空');
            }

            // 构建请求数据
            const requestData = {
                q: searchParams.q.trim(),
                page: parseInt(searchParams.page) || 1,
                size: parseInt(searchParams.size) || 10,
                time: searchParams.time || '',
                type: searchParams.type || '',
                exact: Boolean(searchParams.exact)
            };

            // 发送请求
            const response = await this.makeRequest('/api/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`搜索请求失败: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            
            // 验证响应格式
            if (!result) {
                throw new Error('搜索API未返回数据');
            }

            if (result.code !== 200) {
                throw new Error(result.msg || '搜索失败');
            }

            // 处理搜索结果
            const processedResult = this.processSearchResult(result);
            
            this.logger.info(`搜索完成，找到 ${processedResult.total} 个结果`);
            return processedResult;

        } catch (error) {
            this.logger.error('搜索失败:', error.message);
            throw error;
        }
    }

    /**
     * 处理搜索结果
     * @param {Object} rawResult - 原始搜索结果
     * @returns {Object} 处理后的搜索结果
     */
    processSearchResult(rawResult) {
        const result = {
            success: true,
            total: 0,
            items: [],
            page: 1,
            size: 10
        };

        if (!rawResult.data) {
            return result;
        }

        // 处理搜索结果列表
        if (rawResult.data.list === null) {
            // 没有搜索结果
            result.total = 0;
            result.items = [];
        } else if (Array.isArray(rawResult.data.list)) {
            result.items = rawResult.data.list.map(item => this.formatSearchItem(item));
            result.total = rawResult.data.total || result.items.length;
        } else {
            throw new Error('搜索结果格式异常');
        }

        return result;
    }

    /**
     * 格式化搜索结果项
     * @param {Object} item - 原始搜索结果项
     * @returns {Object} 格式化后的搜索结果项
     */
    formatSearchItem(item) {
        return {
            id: item.disk_id || `${Date.now()}_${Math.random()}`,
            name: item.disk_name || item.files || '未知文件',
            link: item.link || '',
            platform: item.disk_type || '未知平台',
            platformIcon: this.getPlatformIcon(item.disk_type),
            size: this.formatFileSize(item.is_mine),
            shareUser: item.share_user || '未知',
            updateTime: item.update_time || '',
            sharedTime: item.shared_time || '',
            userId: item.u_id || '',
            rawData: item
        };
    }

    /**
     * 获取平台图标
     * @param {string} diskType - 平台类型
     * @returns {string} 图标
     */
    getPlatformIcon(diskType) {
        const icons = {
            'QUARK': '🌟',
            'BDY': '☁️',
            'ALY': '📁',
            'XUNLEI': '⚡'
        };
        return icons[diskType] || '📄';
    }

    /**
     * 格式化文件大小
     * @param {string|number} size - 文件大小
     * @returns {string} 格式化后的文件大小
     */
    formatFileSize(size) {
        if (!size || size === 'false') return '未知';
        if (typeof size === 'string' && size.includes('B')) return size;
        
        const bytes = parseInt(size);
        if (isNaN(bytes)) return size;

        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let unitIndex = 0;
        let fileSize = bytes;

        while (fileSize >= 1024 && unitIndex < units.length - 1) {
            fileSize /= 1024;
            unitIndex++;
        }

        return `${fileSize.toFixed(2)} ${units[unitIndex]}`;
    }

    /**
     * 格式化时间
     * @param {string} timeStr - 时间字符串
     * @returns {string} 格式化后的时间
     */
    formatTime(timeStr) {
        if (!timeStr) return '未知';
        try {
            const date = new Date(timeStr);
            return date.toLocaleString('zh-CN');
        } catch {
            return timeStr;
        }
    }

    /**
     * 发送HTTP请求
     * @param {string} path - 请求路径
     * @param {Object} options - 请求选项
     * @returns {Promise<Response>} 响应对象
     */
    async makeRequest(path, options = {}) {
        const url = `${this.baseUrl}${path}`;
        
        // 设置超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('请求超时');
            }
            
            if (error.message.includes('fetch')) {
                throw new Error('无法连接到代理服务器，请确保代理服务器正在运行');
            }
            
            throw error;
        }
    }

    /**
     * 检查服务器状态
     * @returns {Promise<boolean>} 服务器是否可用
     */
    async checkServerStatus() {
        try {
            const response = await this.makeRequest('/health');
            return response.ok;
        } catch (error) {
            this.logger.error('检查服务器状态失败:', error.message);
            return false;
        }
    }
}
