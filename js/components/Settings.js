/**
 * 设置面板组件
 * 处理应用设置和配置管理
 */

import { formatTimestamp } from '../utils/timeUtils.js';

export class Settings {
    constructor(options) {
        this.dbService = options.dbService;
        this.logger = options.logger;
        this.notificationManager = options.notificationManager;
        this.onCookieTest = options.onCookieTest;
        this.fileListComponent = options.fileListComponent;
        
        this.settings = {
            defaultCookie: '',
            autoSaveEnabled: true,
            duplicateCheckEnabled: true,
            requestTimeout: 30
        };
        
        this.hasUnsavedChanges = false;
        
        this.init();
    }

    /**
     * 初始化组件
     */
    init() {
        this.bindEvents();
        this.loadSettings();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // Cookie保存按钮
        const saveCookieBtn = document.getElementById('saveCookieBtn');
        if (saveCookieBtn) {
            saveCookieBtn.addEventListener('click', () => {
                this.saveCookie();
            });
        }

        // Cookie测试按钮
        const testCookieBtn = document.getElementById('testCookieBtn');
        if (testCookieBtn) {
            testCookieBtn.addEventListener('click', () => {
                this.testCookie();
            });
        }

        // Cookie输入框变化监听
        const defaultCookieInput = document.getElementById('defaultCookie');
        if (defaultCookieInput) {
            defaultCookieInput.addEventListener('input', () => {
                this.updateCookieStatus();
            });
            defaultCookieInput.addEventListener('paste', () => {
                // 延迟执行，确保粘贴内容已经更新
                setTimeout(() => this.updateCookieStatus(), 10);
            });
        }

        // 数据导入按钮
        const importBtn = document.getElementById('importBtn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                this.importData();
            });
        }

        // 数据导出按钮
        const exportDataBtn = document.getElementById('exportDataBtn');
        if (exportDataBtn) {
            exportDataBtn.addEventListener('click', () => {
                this.exportData();
            });
        }

        // 清空数据按钮
        const clearDataBtn = document.getElementById('clearDataBtn');
        if (clearDataBtn) {
            clearDataBtn.addEventListener('click', () => {
                this.confirmClearData();
            });
        }

        // 文件导入输入框
        const importFile = document.getElementById('importFile');
        if (importFile) {
            importFile.addEventListener('change', (e) => {
                this.handleFileImport(e.target.files[0]);
            });
        }

        // 设置项变化监听
        this.bindSettingsChangeEvents();
    }

    /**
     * 绑定设置变化事件
     */
    bindSettingsChangeEvents() {
        const settingsInputs = [
            'defaultCookie',
            'autoSaveEnabled',
            'duplicateCheckEnabled',
            'requestTimeout'
        ];

        settingsInputs.forEach(inputId => {
            const element = document.getElementById(inputId);
            if (element) {
                const eventType = element.type === 'checkbox' ? 'change' : 'input';
                element.addEventListener(eventType, () => {
                    this.markAsChanged();
                });
            }
        });
    }

    /**
     * 标记为已更改
     */
    markAsChanged() {
        this.hasUnsavedChanges = true;
        this.updateSaveButtonState();
    }

    /**
     * 更新保存按钮状态
     */
    updateSaveButtonState() {
        const saveCookieBtn = document.getElementById('saveCookieBtn');
        if (saveCookieBtn) {
            saveCookieBtn.textContent = this.hasUnsavedChanges ? '保存更改' : '已保存';
            saveCookieBtn.disabled = !this.hasUnsavedChanges;
        }
    }

    /**
     * 保存Cookie
     */
    async saveCookie() {
        try {
            const cookieInput = document.getElementById('defaultCookie');
            const cookie = cookieInput ? cookieInput.value.trim() : '';

            if (!cookie) {
                this.notificationManager.warning('输入错误', '请输入Cookie');
                return;
            }

            // 更新设置
            this.settings.defaultCookie = cookie;
            await this.saveAllSettings();

            this.notificationManager.success('保存成功', 'Cookie已保存');
            this.logger.info('Cookie保存成功');
            
        } catch (error) {
            this.logger.error('保存Cookie失败:', error.message);
            this.notificationManager.error('保存失败', '无法保存Cookie');
        }
    }

    /**
     * 测试Cookie
     */
    async testCookie() {
        try {
            const cookieInput = document.getElementById('defaultCookie');
            const cookie = cookieInput ? cookieInput.value.trim() : '';

            if (!cookie) {
                this.notificationManager.warning('输入错误', '请先输入Cookie');
                this.setCookieStatus('empty', '未输入', '⚪');
                return;
            }

            // 设置验证中状态
            this.setCookieStatus('validating', '验证中', '🔄');

            const testCookieBtn = document.getElementById('testCookieBtn');
            if (testCookieBtn) {
                testCookieBtn.disabled = true;
                testCookieBtn.innerHTML = '<span class="quark-gui-loading"></span> 测试中...';
            }

            const result = await this.onCookieTest(cookie);

            if (result) {
                this.setCookieStatus('success', '验证成功', '✅');
                this.notificationManager.success('测试成功', 'Cookie有效，可以正常使用');
            } else {
                this.setCookieStatus('error', '验证失败', '❌');
                this.notificationManager.error('测试失败', 'Cookie无效或已过期');
            }

        } catch (error) {
            this.setCookieStatus('error', '验证失败', '❌');
            this.logger.error('测试Cookie失败:', error.message);
            this.notificationManager.error('测试失败', error.message);
        } finally {
            const testCookieBtn = document.getElementById('testCookieBtn');
            if (testCookieBtn) {
                testCookieBtn.disabled = false;
                testCookieBtn.innerHTML = '测试Cookie';
            }
        }
    }

    /**
     * 导入数据
     */
    importData() {
        const importFile = document.getElementById('importFile');
        if (importFile) {
            importFile.click();
        }
    }

    /**
     * 处理文件导入
     * @param {File} file - 导入的文件
     */
    async handleFileImport(file) {
        if (!file) return;

        try {
            const text = await this.readFileAsText(file);
            const importData = JSON.parse(text);

            // 验证数据格式
            if (!importData.data || !Array.isArray(importData.data)) {
                throw new Error('导入文件格式错误');
            }

            const confirmed = await this.showConfirmDialog(
                '确认导入',
                `即将导入 ${importData.data.length} 个文件记录，是否继续？`
            );

            if (!confirmed) return;

            const importCount = await this.dbService.importData(importData);
            
            this.notificationManager.success('导入成功', `成功导入 ${importCount} 个文件记录`);
            this.logger.info(`数据导入成功: ${importCount} 个记录`);

        } catch (error) {
            this.logger.error('导入数据失败:', error.message);
            this.notificationManager.error('导入失败', error.message);
        }
    }

    /**
     * 读取文件为文本
     * @param {File} file - 文件对象
     * @returns {Promise<string>} 文件内容
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsText(file);
        });
    }

    /**
     * 导出数据
     */
    async exportData() {
        try {
            const exportData = await this.dbService.exportData();
            const dataStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `quark-gui-data-${formatTimestamp(Date.now(), 'YYYY-MM-DD-HH-mm-ss')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.notificationManager.success('导出成功', '数据已导出到文件');
            this.logger.info('数据导出成功');
            
        } catch (error) {
            this.logger.error('导出数据失败:', error.message);
            this.notificationManager.error('导出失败', '无法导出数据');
        }
    }

    /**
     * 确认清空数据
     */
    async confirmClearData() {
        const confirmed = await this.showConfirmDialog(
            '确认清空',
            '此操作将删除所有文件记录，且不可撤销。确定要继续吗？'
        );

        if (confirmed) {
            await this.clearAllData();
        }
    }

    /**
     * 清空所有数据
     */
    async clearAllData() {
        try {
            await this.dbService.clearAllData();

            // 通知文件列表刷新
            if (this.fileListComponent && typeof this.fileListComponent.loadFiles === 'function') {
                await this.fileListComponent.loadFiles();
            }

            this.notificationManager.success('清空成功', '所有数据已清空');
            this.logger.info('所有数据已清空');

        } catch (error) {
            this.logger.error('清空数据失败:', error.message);
            this.notificationManager.error('清空失败', '无法清空数据');
        }
    }

    /**
     * 更新Cookie状态指示器
     */
    updateCookieStatus() {
        const cookieInput = document.getElementById('defaultCookie');
        const statusIndicator = document.getElementById('cookieStatusIndicator');

        if (!cookieInput || !statusIndicator) return;

        const cookieValue = cookieInput.value.trim();

        if (cookieValue === '') {
            this.setCookieStatus('empty', '未输入', '⚪');
        } else {
            // 如果有内容但还未验证，显示为未验证状态
            this.setCookieStatus('empty', '未验证', '⚪');
        }
    }

    /**
     * 设置Cookie状态
     * @param {string} status - 状态类型: empty, validating, error, success
     * @param {string} text - 状态文本
     * @param {string} icon - 状态图标
     */
    setCookieStatus(status, text, icon) {
        const statusIndicator = document.getElementById('cookieStatusIndicator');
        const statusIcon = statusIndicator?.querySelector('.status-icon');
        const statusText = statusIndicator?.querySelector('.status-text');

        if (!statusIndicator || !statusIcon || !statusText) return;

        // 清除所有状态类
        statusIndicator.className = 'cookie-status-indicator';

        // 添加新状态类
        statusIndicator.classList.add(`status-${status}`);

        // 更新图标和文本
        statusIcon.textContent = icon;
        statusText.textContent = text;
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
     * 加载设置
     */
    async loadSettings() {
        try {
            const savedSettings = localStorage.getItem('quark-gui-settings');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                this.settings = { ...this.settings, ...parsed };
            }

            this.applySettingsToUI();
            this.hasUnsavedChanges = false;
            this.updateSaveButtonState();
            
            this.logger.info('设置加载完成');
            
        } catch (error) {
            this.logger.error('加载设置失败:', error.message);
        }
    }

    /**
     * 应用设置到UI
     */
    applySettingsToUI() {
        // Cookie设置
        const defaultCookieInput = document.getElementById('defaultCookie');
        if (defaultCookieInput) {
            defaultCookieInput.value = this.settings.defaultCookie || '';
        }

        // 初始化Cookie状态指示器
        this.updateCookieStatus();

        // 自动保存设置
        const autoSaveCheckbox = document.getElementById('autoSaveEnabled');
        if (autoSaveCheckbox) {
            autoSaveCheckbox.checked = this.settings.autoSaveEnabled;
        }

        // 重复检测设置
        const duplicateCheckCheckbox = document.getElementById('duplicateCheckEnabled');
        if (duplicateCheckCheckbox) {
            duplicateCheckCheckbox.checked = this.settings.duplicateCheckEnabled;
        }

        // 请求超时设置
        const requestTimeoutInput = document.getElementById('requestTimeout');
        if (requestTimeoutInput) {
            requestTimeoutInput.value = this.settings.requestTimeout;
        }
    }

    /**
     * 保存所有设置
     */
    async saveAllSettings() {
        try {
            // 从UI收集设置
            this.collectSettingsFromUI();

            // 保存到本地存储
            localStorage.setItem('quark-gui-settings', JSON.stringify(this.settings));

            this.hasUnsavedChanges = false;
            this.updateSaveButtonState();
            
            this.logger.info('所有设置已保存');
            
        } catch (error) {
            this.logger.error('保存设置失败:', error.message);
            throw error;
        }
    }

    /**
     * 从UI收集设置
     */
    collectSettingsFromUI() {
        const defaultCookieInput = document.getElementById('defaultCookie');
        if (defaultCookieInput) {
            this.settings.defaultCookie = defaultCookieInput.value.trim();
        }

        const autoSaveCheckbox = document.getElementById('autoSaveEnabled');
        if (autoSaveCheckbox) {
            this.settings.autoSaveEnabled = autoSaveCheckbox.checked;
        }

        const duplicateCheckCheckbox = document.getElementById('duplicateCheckEnabled');
        if (duplicateCheckCheckbox) {
            this.settings.duplicateCheckEnabled = duplicateCheckCheckbox.checked;
        }

        const requestTimeoutInput = document.getElementById('requestTimeout');
        if (requestTimeoutInput) {
            this.settings.requestTimeout = parseInt(requestTimeoutInput.value) || 30;
        }
    }

    /**
     * 获取设置值
     * @param {string} key - 设置键
     * @returns {any} 设置值
     */
    getSetting(key) {
        return this.settings[key];
    }

    /**
     * 设置值
     * @param {string} key - 设置键
     * @param {any} value - 设置值
     */
    setSetting(key, value) {
        this.settings[key] = value;
        this.markAsChanged();
    }

    /**
     * 检查是否有未保存的更改
     * @returns {boolean} 是否有未保存的更改
     */
    hasUnsavedChanges() {
        return this.hasUnsavedChanges;
    }

    /**
     * 重置设置
     */
    async resetSettings() {
        const confirmed = await this.showConfirmDialog(
            '重置设置',
            '确定要重置所有设置到默认值吗？'
        );

        if (confirmed) {
            this.settings = {
                defaultCookie: '',
                autoSaveEnabled: true,
                duplicateCheckEnabled: true,
                requestTimeout: 30
            };

            this.applySettingsToUI();
            await this.saveAllSettings();
            
            this.notificationManager.success('重置成功', '设置已重置到默认值');
            this.logger.info('设置已重置');
        }
    }

    /**
     * 面板激活回调
     */
    async onActivated() {
        this.logger.info('设置面板已激活');
        await this.loadSettings();
    }
}

export default Settings;
