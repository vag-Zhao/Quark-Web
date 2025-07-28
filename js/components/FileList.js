/**
 * 文件列表组件
 * 处理文件列表显示和管理功能
 */

import { formatTimestamp, getRelativeTime } from '../utils/timeUtils.js';

export class FileList {
    constructor(options) {
        this.dbService = options.dbService;
        this.logger = options.logger;
        this.notificationManager = options.notificationManager;
        
        this.currentPage = 1;
        this.pageSize = 5; // 改为每页显示5个
        this.totalFiles = 0;
        this.totalPages = 0;
        this.currentFiles = [];
        this.selectedFiles = new Set();
        this.searchKeyword = '';
        this.sortBy = 'createTime';
        this.sortOrder = 'desc';
        
        this.init();
    }

    /**
     * 初始化组件
     */
    init() {
        this.bindEvents();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 搜索按钮
        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.handleSearch();
            });
        }

        // 搜索输入框回车事件
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSearch();
                }
            });
        }

        // 刷新按钮
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refresh();
            });
        }

        // 导出按钮
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportFiles();
            });
        }

        // 全选复选框
        const selectAllCheckbox = document.getElementById('selectAll');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                this.handleSelectAll(e.target.checked);
            });
        }

        // 分页按钮
        const prevPageBtn = document.getElementById('prevPage');
        const nextPageBtn = document.getElementById('nextPage');
        
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => {
                this.goToPage(this.currentPage - 1);
            });
        }
        
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => {
                this.goToPage(this.currentPage + 1);
            });
        }
    }

    /**
     * 处理搜索
     */
    async handleSearch() {
        const searchInput = document.getElementById('searchInput');
        this.searchKeyword = searchInput ? searchInput.value.trim() : '';
        this.currentPage = 1;
        await this.loadFiles();
    }

    /**
     * 刷新文件列表
     */
    async refresh() {
        this.logger.info('刷新文件列表');
        await this.loadFiles();
        this.notificationManager.info('刷新完成', '文件列表已更新');
    }

    /**
     * 加载文件列表
     */
    async loadFiles() {
        try {
            this.showLoading(true);

            let files;
            if (this.searchKeyword) {
                files = await this.dbService.searchFiles(this.searchKeyword);
            } else {
                files = await this.dbService.getAllFiles({
                    sortBy: this.sortBy,
                    sortOrder: this.sortOrder
                });
            }

            this.totalFiles = files.length;
            this.totalPages = Math.ceil(this.totalFiles / this.pageSize);

            // 分页处理
            const startIndex = (this.currentPage - 1) * this.pageSize;
            const endIndex = startIndex + this.pageSize;
            this.currentFiles = files.slice(startIndex, endIndex);

            this.renderFileList();
            this.updatePagination();
            this.updateSelectAllState();

            this.logger.info(`加载了 ${this.currentFiles.length} 个文件，共 ${this.totalFiles} 个`);

        } catch (error) {
            this.logger.error('加载文件列表失败:', error.message);
            this.notificationManager.error('加载失败', '无法加载文件列表');
            this.showEmptyState('加载失败');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 渲染文件列表
     */
    renderFileList() {
        const tableBody = document.getElementById('filesTableBody');
        if (!tableBody) return;

        if (this.currentFiles.length === 0) {
            this.showEmptyState();
            return;
        }

        const html = this.currentFiles.map(file => this.createFileRow(file)).join('');
        tableBody.innerHTML = html;

        // 绑定行事件
        this.bindRowEvents();
    }

    /**
     * 创建文件行HTML
     * @param {Object} file - 文件对象
     * @returns {string} HTML字符串
     */
    createFileRow(file) {
        const isSelected = this.selectedFiles.has(file.id);
        const relativeTime = getRelativeTime(new Date(file.createTime).getTime());
        
        return `
            <tr data-file-id="${file.id}" class="${isSelected ? 'selected' : ''}">
                <td>
                    <input type="checkbox" class="file-checkbox" ${isSelected ? 'checked' : ''}>
                </td>
                <td>
                    <div class="file-info">
                        <div class="file-name" title="${file.fileName}">${this.escapeHtml(file.fileName)}</div>
                        <div class="file-meta">创建于 ${relativeTime}</div>
                    </div>
                </td>
                <td>
                    <div class="share-link-cell">
                        <input type="text" class="share-link-input" value="${file.shareUrl || file.shareLink || ''}" readonly>
                        <button class="quark-gui-btn quark-gui-btn-secondary copy-link-btn" data-link="${file.shareUrl || file.shareLink || ''}" title="复制链接">
                            <span class="quark-gui-icon">📋</span>
                            复制
                        </button>
                    </div>
                </td>
                <td>
                    <div class="quark-gui-table-actions">
                        <button class="quark-gui-btn quark-gui-btn-secondary" onclick="window.open('${file.shareUrl || file.shareLink || ''}', '_blank')" title="打开链接">
                            <span class="quark-gui-icon">🔗</span>
                            打开
                        </button>
                        <button class="quark-gui-btn quark-gui-btn-secondary delete-file-btn" data-file-id="${file.id}" title="删除文件">
                            <span class="quark-gui-icon">🗑️</span>
                            删除
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * 绑定行事件
     */
    bindRowEvents() {
        // 复选框事件
        const checkboxes = document.querySelectorAll('.file-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const row = e.target.closest('tr');
                const fileId = parseInt(row.dataset.fileId);
                this.handleFileSelect(fileId, e.target.checked);
            });
        });

        // 复制链接按钮
        const copyBtns = document.querySelectorAll('.copy-link-btn');
        copyBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const link = e.target.dataset.link;
                this.copyToClipboard(link);
            });
        });

        // 删除按钮
        const deleteBtns = document.querySelectorAll('.delete-file-btn');
        deleteBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fileId = parseInt(e.target.dataset.fileId);
                this.confirmDeleteFile(fileId);
            });
        });
    }

    /**
     * 处理文件选择
     * @param {number} fileId - 文件ID
     * @param {boolean} selected - 是否选中
     */
    handleFileSelect(fileId, selected) {
        if (selected) {
            this.selectedFiles.add(fileId);
        } else {
            this.selectedFiles.delete(fileId);
        }

        // 更新行样式
        const row = document.querySelector(`tr[data-file-id="${fileId}"]`);
        if (row) {
            row.classList.toggle('selected', selected);
        }

        this.updateSelectAllState();
    }

    /**
     * 处理全选
     * @param {boolean} selectAll - 是否全选
     */
    handleSelectAll(selectAll) {
        this.selectedFiles.clear();
        
        if (selectAll) {
            this.currentFiles.forEach(file => {
                this.selectedFiles.add(file.id);
            });
        }

        // 更新所有复选框
        const checkboxes = document.querySelectorAll('.file-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAll;
        });

        // 更新行样式
        const rows = document.querySelectorAll('#filesTableBody tr');
        rows.forEach(row => {
            row.classList.toggle('selected', selectAll);
        });
    }

    /**
     * 更新全选状态
     */
    updateSelectAllState() {
        const selectAllCheckbox = document.getElementById('selectAll');
        if (!selectAllCheckbox) return;

        const totalCurrentFiles = this.currentFiles.length;
        const selectedCurrentFiles = this.currentFiles.filter(file =>
            this.selectedFiles.has(file.id)
        ).length;

        if (selectedCurrentFiles === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (selectedCurrentFiles === totalCurrentFiles) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
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
            // 降级方案
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            this.notificationManager.success('复制成功', '链接已复制到剪贴板');
        }
    }

    /**
     * 确认删除文件
     * @param {number} fileId - 文件ID
     */
    async confirmDeleteFile(fileId) {
        const file = this.currentFiles.find(f => f.id === fileId);
        if (!file) return;

        const confirmed = await this.showConfirmDialog(
            '确认删除',
            `确定要删除文件 "${file.fileName}" 吗？此操作不可撤销。`
        );

        if (confirmed) {
            await this.deleteFile(fileId);
        }
    }

    /**
     * 删除文件
     * @param {number} fileId - 文件ID
     */
    async deleteFile(fileId) {
        try {
            await this.dbService.deleteFile(fileId);
            this.selectedFiles.delete(fileId);
            await this.loadFiles();
            
            this.notificationManager.success('删除成功', '文件已从列表中删除');
            this.logger.info(`文件删除成功: ID ${fileId}`);
            
        } catch (error) {
            this.logger.error('删除文件失败:', error.message);
            this.notificationManager.error('删除失败', '无法删除文件');
        }
    }

    /**
     * 显示确认对话框
     * @param {string} title - 标题
     * @param {string} message - 消息
     * @returns {Promise<boolean>} 是否确认
     */
    showConfirmDialog(title, message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('modal');
            const modalTitle = document.getElementById('modalTitle');
            const modalBody = document.getElementById('modalBody');
            const modalConfirm = document.getElementById('modalConfirm');
            const modalCancel = document.getElementById('modalCancel');

            if (modalTitle) modalTitle.textContent = title;
            if (modalBody) modalBody.innerHTML = `<p>${message}</p>`;

            if (modalConfirm) {
                modalConfirm.textContent = '确定';
                modalConfirm.onclick = () => {
                    modal.style.display = 'none';
                    resolve(true);
                };
            }

            if (modalCancel) {
                modalCancel.onclick = () => {
                    modal.style.display = 'none';
                    resolve(false);
                };
            }

            if (modal) {
                modal.style.display = 'flex';
            }
        });
    }

    /**
     * 导出文件列表
     */
    async exportFiles() {
        try {
            const exportData = await this.dbService.exportData();
            const dataStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `quark-files-${formatTimestamp(Date.now(), 'YYYY-MM-DD-HH-mm-ss')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.notificationManager.success('导出成功', '文件列表已导出');
            this.logger.info('文件列表导出成功');
            
        } catch (error) {
            this.logger.error('导出文件列表失败:', error.message);
            this.notificationManager.error('导出失败', '无法导出文件列表');
        }
    }

    /**
     * 跳转到指定页面
     * @param {number} page - 页码
     */
    async goToPage(page) {
        if (page < 1 || page > this.totalPages) return;
        
        this.currentPage = page;
        await this.loadFiles();
    }

    /**
     * 更新分页信息
     */
    updatePagination() {
        const pageInfo = document.getElementById('pageInfo');
        const prevPageBtn = document.getElementById('prevPage');
        const nextPageBtn = document.getElementById('nextPage');

        if (pageInfo) {
            pageInfo.textContent = `第 ${this.currentPage} 页，共 ${this.totalPages} 页`;
        }

        if (prevPageBtn) {
            prevPageBtn.disabled = this.currentPage <= 1;
        }

        if (nextPageBtn) {
            nextPageBtn.disabled = this.currentPage >= this.totalPages;
        }
    }

    /**
     * 显示加载状态
     * @param {boolean} show - 是否显示
     */
    showLoading(show) {
        const tableBody = document.getElementById('filesTableBody');
        if (!tableBody) return;

        if (show) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 40px;">
                        <div class="quark-gui-loading"></div>
                        <div style="margin-top: 10px;">加载中...</div>
                    </td>
                </tr>
            `;
        }
    }

    /**
     * 显示空状态
     * @param {string} message - 消息
     */
    showEmptyState(message = '暂无文件') {
        const tableBody = document.getElementById('filesTableBody');
        if (!tableBody) return;

        tableBody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="quark-gui-empty">
                        <div class="quark-gui-empty-icon">📁</div>
                        <div class="quark-gui-empty-title">${message}</div>
                        <div class="quark-gui-empty-description">
                            ${message === '暂无文件' ? '还没有转存任何文件，去转存一些文件吧！' : ''}
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * 获取文件类型样式类
     * @param {string} fileType - 文件类型
     * @returns {string} 样式类名
     */
    getFileTypeClass(fileType) {
        const type = (fileType || '').toString().toLowerCase();
        if (type.includes('video')) return 'warning';
        if (type.includes('image')) return 'success';
        if (type.includes('audio')) return 'info';
        return '';
    }

    /**
     * 转义HTML
     * @param {string} text - 文本
     * @returns {string} 转义后的文本
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 面板激活回调
     */
    async onActivated() {
        this.logger.info('文件列表面板已激活');
        await this.loadFiles();
    }
}

export default FileList;
