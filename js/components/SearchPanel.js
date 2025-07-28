/**
 * 搜索面板组件
 * 负责资源搜索功能的界面和逻辑
 */

import SearchService from '../services/SearchService.js';

export default class SearchPanel {
    constructor(options = {}) {
        this.logger = options.logger;
        this.notificationManager = options.notificationManager;
        this.dbService = options.dbService; // 数据库服务
        this.onQuarkServiceNeeded = options.onQuarkServiceNeeded; // 获取夸克服务的回调
        this.onFileTransferred = options.onFileTransferred; // 文件转存成功的回调

        // 初始化搜索服务
        this.searchService = new SearchService(this.logger);

        // 搜索状态
        this.currentResults = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.isSearching = false;

        // 转存状态跟踪
        this.transferringItems = new Set(); // 正在转存的项目ID
        this.transferredItems = new Set(); // 已转存的项目ID

        this.init();
    }

    /**
     * 初始化组件
     */
    init() {
        this.bindEvents();
        this.logger.info('搜索面板初始化完成');
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 搜索按钮
        const searchBtn = document.getElementById('resourceSearchBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.handleSearch());
        }

        // 清空按钮
        const clearBtn = document.getElementById('clearSearchBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearForm());
        }

        // 搜索表单回车提交
        const searchQuery = document.getElementById('searchQuery');
        if (searchQuery) {
            searchQuery.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSearch();
                }
            });
        }

        // 分页按钮
        const prevBtn = document.getElementById('searchPrevPage');
        const nextBtn = document.getElementById('searchNextPage');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.goToPreviousPage());
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.goToNextPage());
        }
    }

    /**
     * 处理搜索请求
     */
    async handleSearch() {
        if (this.isSearching) {
            return;
        }

        try {
            // 获取搜索参数
            const searchParams = this.getSearchParams();
            
            if (!searchParams.q.trim()) {
                this.notificationManager.warning('请输入搜索关键词', '搜索关键词不能为空');
                return;
            }

            this.setSearching(true);
            this.showSearchResults();

            // 执行搜索
            const result = await this.searchService.search(searchParams);
            
            // 显示搜索结果
            this.displaySearchResults(result);
            
            this.notificationManager.success('搜索完成', `找到 ${result.total} 个相关资源`);

        } catch (error) {
            this.logger.error('搜索失败:', error.message);
            this.notificationManager.error('搜索失败', error.message);
            this.displaySearchError(error.message);
        } finally {
            this.setSearching(false);
        }
    }

    /**
     * 获取搜索参数
     * @returns {Object} 搜索参数
     */
    getSearchParams() {
        return {
            q: document.getElementById('searchQuery')?.value || '',
            page: parseInt(document.getElementById('searchPage')?.value) || 1,
            size: parseInt(document.getElementById('searchSize')?.value) || 10,
            time: document.getElementById('searchTime')?.value || '',
            type: document.getElementById('searchType')?.value || '',
            exact: document.getElementById('searchExact')?.checked || false
        };
    }

    /**
     * 设置搜索状态
     * @param {boolean} searching - 是否正在搜索
     */
    setSearching(searching) {
        this.isSearching = searching;
        
        const searchBtn = document.getElementById('resourceSearchBtn');
        if (searchBtn) {
            searchBtn.disabled = searching;
            searchBtn.innerHTML = searching ? 
                '<span class="quark-gui-icon">⏳</span> 搜索中...' : 
                '<span class="quark-gui-icon">🔍</span> 开始搜索';
        }
    }

    /**
     * 显示搜索结果区域
     */
    showSearchResults() {
        const resultsDiv = document.getElementById('searchResults');
        if (resultsDiv) {
            resultsDiv.style.display = 'block';
        }
    }

    /**
     * 显示搜索结果
     * @param {Object} result - 搜索结果
     */
    displaySearchResults(result) {
        const contentDiv = document.getElementById('searchResultsContent');
        const statsDiv = document.getElementById('searchStats');
        
        if (!contentDiv) return;

        // 更新统计信息
        if (statsDiv) {
            statsDiv.textContent = `共找到 ${result.total} 个结果`;
        }

        // 保存当前结果
        this.currentResults = result.items;
        this.currentPage = result.page || 1;
        this.totalPages = Math.ceil(result.total / (result.size || 10));

        if (result.items.length === 0) {
            contentDiv.innerHTML = this.getEmptyResultsHTML();
            this.updatePagination();
            return;
        }

        // 生成结果HTML
        const html = result.items.map(item => this.generateResultItemHTML(item)).join('');
        contentDiv.innerHTML = html;

        // 绑定结果项事件
        this.bindResultEvents();
        
        // 更新分页
        this.updatePagination();
    }

    /**
     * 生成搜索结果项HTML
     * @param {Object} item - 搜索结果项
     * @returns {string} HTML字符串
     */
    generateResultItemHTML(item) {
        return `
            <div class="quark-gui-search-result-item" data-item-id="${item.id}">
                <div class="quark-gui-search-result-header">
                    <h4 class="quark-gui-search-result-title">
                        ${item.platformIcon} ${item.name}
                    </h4>
                    <span class="quark-gui-search-result-platform">${item.platform}</span>
                </div>
                
                <div class="quark-gui-search-result-info">
                    <div><strong>📊 大小:</strong> ${item.size}</div>
                    <div><strong>👤 分享者:</strong> ${item.shareUser}</div>
                    <div><strong>🕒 更新时间:</strong> ${this.searchService.formatTime(item.updateTime)}</div>
                    ${item.sharedTime ? `<div><strong>📅 分享时间:</strong> ${this.searchService.formatTime(item.sharedTime)}</div>` : ''}
                </div>
                
                ${item.link ? `
                    <div class="quark-gui-search-result-link">
                        <strong>🔗 分享链接:</strong>
                        <a href="${item.link}" target="_blank">${item.link}</a>
                    </div>
                ` : ''}
                
                <div class="quark-gui-search-result-actions">
                    ${item.link && item.platform === 'QUARK' ? `
                        <button class="quark-gui-btn quark-gui-btn-primary quark-gui-btn-small transfer-btn"
                                data-link="${item.link}" data-name="${item.name}">
                            <span class="quark-gui-icon">📤</span>
                            转存
                        </button>
                    ` : ''}
                    <button class="quark-gui-btn quark-gui-btn-secondary quark-gui-btn-small copy-link-btn"
                            data-link="${item.link}">
                        <span class="quark-gui-icon">📋</span>
                        复制链接
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 获取空结果HTML
     * @returns {string} HTML字符串
     */
    getEmptyResultsHTML() {
        return `
            <div style="text-align: center; padding: 40px; color: var(--quark-text-secondary);">
                <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
                <h3>未找到相关资源</h3>
                <p>请尝试使用不同的关键词或调整搜索条件</p>
            </div>
        `;
    }

    /**
     * 绑定搜索结果事件
     */
    bindResultEvents() {
        // 转存按钮
        const transferBtns = document.querySelectorAll('.transfer-btn');
        transferBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const link = e.currentTarget.dataset.link;
                const name = e.currentTarget.dataset.name;
                const itemId = e.currentTarget.closest('.quark-gui-search-result-item').dataset.itemId;
                this.handleTransferRequest(link, name, itemId);
            });
        });

        // 复制链接按钮
        const copyBtns = document.querySelectorAll('.copy-link-btn');
        copyBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const link = e.currentTarget.dataset.link;
                this.copyToClipboard(link);
            });
        });
    }

    /**
     * 处理转存请求 - 直接执行转存操作
     * @param {string} link - 分享链接
     * @param {string} name - 文件名
     * @param {string} itemId - 搜索结果项ID
     */
    async handleTransferRequest(link, name, itemId) {
        if (!link || !link.trim()) {
            this.notificationManager.error('转存失败', '分享链接不能为空');
            return;
        }

        // 清理文件名，移除HTML标签和框架标识符
        const cleanName = this.cleanFileName(name);
        if (!cleanName) {
            this.notificationManager.error('转存失败', '文件名无效');
            return;
        }

        // 检查是否已在转存中
        if (this.transferringItems.has(itemId)) {
            return;
        }

        // 检查是否已转存
        if (this.transferredItems.has(itemId)) {
            this.notificationManager.info('已转存', '该文件已经转存过了');
            return;
        }

        try {
            // 设置转存状态
            this.setTransferState(itemId, 'transferring');
            this.transferringItems.add(itemId);

            this.logger.info(`开始转存文件: ${cleanName}`, {
                originalName: name,
                cleanName,
                link,
                itemId
            });

            // 检查是否已经转存过相同文件（使用清理后的文件名）
            if (this.dbService && typeof this.dbService.checkDuplicate === 'function') {
                const duplicateCheck = await this.dbService.checkDuplicate(cleanName, link);
                if (duplicateCheck.exists) {
                    this.setTransferState(itemId, 'success');
                    this.transferredItems.add(itemId);

                    let message = `"${cleanName}" 已经转存过了，无需重复转存`;
                    if (duplicateCheck.duplicateType === 'both') {
                        message += '（文件名和链接都已存在）';
                    } else if (duplicateCheck.duplicateType === 'name') {
                        message += '（相同文件名已存在）';
                    } else if (duplicateCheck.duplicateType === 'link') {
                        message += '（相同链接已存在）';
                    }

                    this.notificationManager.info('文件已存在', message);
                    this.logger.info(`跳过重复转存: ${cleanName}`, duplicateCheck);
                    return;
                }
            }

            // 获取Cookie配置
            const cookie = await this.getCookieFromSettings();
            if (!cookie) {
                throw new Error('请先在设置面板中配置夸克网盘Cookie后再进行转存操作');
            }

            // 获取夸克服务实例
            let quarkService;
            try {
                quarkService = this.onQuarkServiceNeeded(cookie);
                if (!quarkService) {
                    throw new Error('无法创建夸克服务实例');
                }
            } catch (serviceError) {
                throw new Error(`创建夸克服务失败: ${serviceError.message}`);
            }

            // 简单验证Cookie格式
            if (!this.isValidCookieFormat(cookie)) {
                throw new Error('Cookie格式不正确，请检查Cookie配置');
            }

            // 执行转存操作（使用清理后的文件名）
            const result = await this.performTransfer(quarkService, link, cleanName);

            // 保存转存记录到数据库
            if (this.dbService && result.success) {
                await this.saveTransferRecord(result, link, cleanName);
            }

            // 设置成功状态
            this.setTransferState(itemId, 'success');
            this.transferredItems.add(itemId);

            this.notificationManager.success('转存成功', `"${cleanName}" 已成功转存到您的网盘`);
            this.logger.info(`转存成功: ${cleanName}`, {
                originalName: name,
                cleanName,
                result
            });

            // 通知主应用文件已转存，需要刷新文件列表
            if (this.onFileTransferred) {
                this.onFileTransferred().catch(err => {
                    this.logger.error('文件转存回调执行失败:', err.message);
                });
            }

        } catch (error) {
            this.logger.error(`转存失败: ${cleanName}`, {
                originalName: name,
                cleanName,
                error: error.message
            });

            // 根据错误类型提供不同的用户提示
            let userMessage = error.message;
            if (error.message.includes('ECONNRESET') || error.message.includes('network')) {
                userMessage = '网络连接不稳定，请检查网络后重试';
            } else if (error.message.includes('HTTP 500')) {
                userMessage = '服务器暂时不可用，请稍后重试';
            } else if (error.message.includes('HTTP 401') || error.message.includes('HTTP 403')) {
                userMessage = 'Cookie已过期或无效，请重新配置Cookie';
            } else if (error.message.includes('timeout') || error.message.includes('超时')) {
                userMessage = '请求超时，请检查网络连接后重试';
            }

            this.notificationManager.error('转存失败', userMessage);
            this.setTransferState(itemId, 'error');
        } finally {
            this.transferringItems.delete(itemId);
        }
    }

    /**
     * 获取Cookie配置
     * @returns {Promise<string>} Cookie字符串
     */
    async getCookieFromSettings() {
        try {
            // 首先尝试从localStorage获取（这是设置面板保存Cookie的地方）
            const cookieFromStorage = localStorage.getItem('quark-default-cookie');
            if (cookieFromStorage) {
                return cookieFromStorage;
            }

            // 如果localStorage没有，尝试从数据库获取
            if (this.dbService && typeof this.dbService.getSettings === 'function') {
                const settings = await this.dbService.getSettings();
                return settings?.defaultCookie || '';
            }

            // 最后尝试从DOM元素获取（如果设置面板中有值）
            const cookieTextarea = document.getElementById('defaultCookie');
            if (cookieTextarea && cookieTextarea.value.trim()) {
                return cookieTextarea.value.trim();
            }

            return '';
        } catch (error) {
            this.logger.error('获取Cookie配置失败:', error.message);

            // 降级方案：直接从DOM获取
            try {
                const cookieTextarea = document.getElementById('defaultCookie');
                return cookieTextarea?.value?.trim() || '';
            } catch (domError) {
                this.logger.error('从DOM获取Cookie也失败:', domError.message);
                return '';
            }
        }
    }

    /**
     * 执行转存操作
     * @param {Object} quarkService - 夸克服务实例
     * @param {string} link - 分享链接
     * @param {string} name - 文件名
     * @returns {Promise<Object>} 转存结果
     */
    async performTransfer(quarkService, link, name) {
        // 使用QuarkWebService的store方法执行转存
        const result = await quarkService.store(link, (step, message, progress) => {
            // 可以在这里更新UI进度，但为了简化暂时不实现
            this.logger.info(`转存进度: 步骤${step} - ${message} (${progress}%)`);
        });

        if (!result.success) {
            throw new Error(result.message || '转存失败');
        }

        return {
            success: true,
            originalLink: link,
            fileName: name,
            newShareLink: result.data?.shareLink || '',
            fileId: result.data?.fileId || '',
            timestamp: new Date().toISOString(),
            rawResult: result
        };
    }

    /**
     * 保存转存记录到数据库
     * @param {Object} result - 转存结果
     * @param {string} originalLink - 原始链接
     * @param {string} fileName - 文件名
     */
    async saveTransferRecord(result, originalLink, fileName) {
        try {
            if (!this.dbService) {
                this.logger.warn('数据库服务不可用，跳过保存转存记录');
                return;
            }

            const record = {
                fileName: fileName,
                originalUrl: originalLink,
                shareUrl: result.newShareLink || '', // 保持shareUrl字段用于显示
                shareLink: result.newShareLink || '', // 同时保存shareLink字段用于重复检测
                transferTime: result.timestamp,
                source: 'search', // 标记来源为搜索
                status: 'completed',
                fileId: result.fileId || '',
                fileType: this.extractFileType(fileName) // 添加文件类型
            };

            // 检查数据库服务是否有addFile方法
            if (typeof this.dbService.addFile === 'function') {
                this.logger.info('准备保存转存记录到数据库', record);
                const recordId = await this.dbService.addFile(record);
                this.logger.info('转存记录已保存到数据库', { recordId, record });
            } else {
                this.logger.warn('数据库服务缺少addFile方法，无法保存转存记录');
            }
        } catch (error) {
            this.logger.error('保存转存记录失败:', error.message);
            // 不抛出错误，因为转存本身已经成功
            // 但可以给用户一个提示
            this.notificationManager.warning('提示', '转存成功，但记录保存失败，不影响文件转存');
        }
    }

    /**
     * 设置转存状态
     * @param {string} itemId - 项目ID
     * @param {string} state - 状态：transferring, success, error
     */
    setTransferState(itemId, state) {
        const button = document.querySelector(`[data-item-id="${itemId}"] .transfer-btn`);
        if (!button) return;

        // 重置所有状态类
        button.classList.remove('transferring', 'success', 'error');

        switch (state) {
            case 'transferring':
                button.classList.add('transferring');
                button.disabled = true;
                button.innerHTML = '<span class="quark-gui-icon">⏳</span> 转存中...';
                break;
            case 'success':
                button.classList.add('success');
                button.disabled = true;
                button.innerHTML = '<span class="quark-gui-icon">✅</span> 已转存';
                break;
            case 'error':
                button.classList.add('error');
                button.disabled = false;
                button.innerHTML = '<span class="quark-gui-icon">📤</span> 转存';
                break;
            default:
                button.disabled = false;
                button.innerHTML = '<span class="quark-gui-icon">📤</span> 转存';
        }
    }

    /**
     * 清理文件名，移除HTML标签和框架标识符
     * @param {string} fileName - 原始文件名
     * @returns {string} 清理后的文件名
     */
    cleanFileName(fileName) {
        if (!fileName || typeof fileName !== 'string') {
            return '';
        }

        // 移除HTML标签
        let cleanName = fileName.replace(/<[^>]*>/g, '');

        // 移除常见的搜索高亮标识符
        cleanName = cleanName.replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&amp;/g, '&')
                            .replace(/&quot;/g, '"')
                            .replace(/&#39;/g, "'");

        // 移除多余的空白字符
        cleanName = cleanName.replace(/\s+/g, ' ').trim();

        // 如果清理后为空，返回默认名称
        if (!cleanName) {
            return '未知文件';
        }

        return cleanName;
    }

    /**
     * 从文件名提取文件类型
     * @param {string} fileName - 文件名
     * @returns {string} 文件类型
     */
    extractFileType(fileName) {
        if (!fileName || typeof fileName !== 'string') {
            return 'unknown';
        }

        const lastDotIndex = fileName.lastIndexOf('.');
        if (lastDotIndex === -1 || lastDotIndex === fileName.length - 1) {
            return 'unknown';
        }

        return fileName.substring(lastDotIndex + 1).toLowerCase();
    }

    /**
     * 验证Cookie格式是否正确
     * @param {string} cookie - Cookie字符串
     * @returns {boolean} 是否有效
     */
    isValidCookieFormat(cookie) {
        if (!cookie || typeof cookie !== 'string') {
            return false;
        }

        // 基本格式检查：应该包含键值对，用分号分隔
        const cookiePairs = cookie.split(';');
        if (cookiePairs.length === 0) {
            return false;
        }

        // 检查是否包含必要的夸克网盘相关字段
        const requiredFields = ['__pus', '__puus']; // 夸克网盘常见的Cookie字段
        const hasRequiredField = requiredFields.some(field =>
            cookie.includes(field + '=')
        );

        return hasRequiredField;
    }

    /**
     * 复制到剪贴板
     * @param {string} text - 要复制的文本
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.notificationManager.success('复制成功', '链接已复制到剪贴板');
        } catch (error) {
            this.logger.error('复制失败:', error.message);
            this.notificationManager.error('复制失败', '请手动复制链接');
        }
    }

    /**
     * 显示搜索错误
     * @param {string} errorMessage - 错误信息
     */
    displaySearchError(errorMessage) {
        const contentDiv = document.getElementById('searchResultsContent');
        if (!contentDiv) return;

        contentDiv.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--quark-error-color);">
                <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
                <h3>搜索失败</h3>
                <p>${errorMessage}</p>
                <button class="quark-gui-btn quark-gui-btn-secondary" onclick="location.reload()">
                    重新尝试
                </button>
            </div>
        `;
    }

    /**
     * 清空搜索表单
     */
    clearForm() {
        document.getElementById('searchQuery').value = '';
        document.getElementById('searchPage').value = '1';
        document.getElementById('searchSize').value = '10';
        document.getElementById('searchTime').value = '';
        document.getElementById('searchType').value = '';
        document.getElementById('searchExact').checked = false;
        
        // 隐藏搜索结果
        const resultsDiv = document.getElementById('searchResults');
        if (resultsDiv) {
            resultsDiv.style.display = 'none';
        }
        
        this.currentResults = [];
        this.notificationManager.info('已清空', '搜索表单已重置');
    }

    /**
     * 更新分页
     */
    updatePagination() {
        const pageInfo = document.getElementById('searchPageInfo');
        const prevBtn = document.getElementById('searchPrevPage');
        const nextBtn = document.getElementById('searchNextPage');
        
        if (pageInfo) {
            pageInfo.textContent = `第 ${this.currentPage} 页，共 ${this.totalPages} 页`;
        }
        
        if (prevBtn) {
            prevBtn.disabled = this.currentPage <= 1;
        }
        
        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= this.totalPages;
        }
    }

    /**
     * 上一页
     */
    async goToPreviousPage() {
        if (this.currentPage > 1) {
            const searchParams = this.getSearchParams();
            searchParams.page = this.currentPage - 1;
            document.getElementById('searchPage').value = searchParams.page;
            await this.handleSearch();
        }
    }

    /**
     * 下一页
     */
    async goToNextPage() {
        if (this.currentPage < this.totalPages) {
            const searchParams = this.getSearchParams();
            searchParams.page = this.currentPage + 1;
            document.getElementById('searchPage').value = searchParams.page;
            await this.handleSearch();
        }
    }

    /**
     * 面板激活时调用
     */
    onActivated() {
        this.logger.info('搜索面板已激活');
        
        // 聚焦搜索框
        const searchQuery = document.getElementById('searchQuery');
        if (searchQuery) {
            searchQuery.focus();
        }
    }

    /**
     * 处理窗口大小变化
     */
    handleResize() {
        // 响应式处理逻辑
        this.logger.info('搜索面板响应窗口大小变化');
    }
}
