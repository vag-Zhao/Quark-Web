import QuarkWebService from './services/QuarkWebService.js';
import IndexedDBService from './services/IndexedDBService.js';
import TransferPanel from './components/TransferPanel.js';
import FileList from './components/FileList.js';
import Settings from './components/Settings.js';
import SearchPanel from './components/SearchPanel.js';
import Logger from './utils/Logger.js';
import NotificationManager from './utils/NotificationManager.js';
import ProxyManager from './utils/ProxyManager.js';
import ThemeManager from './utils/ThemeManager.js';

class QuarkGUIApp {
    constructor() {
        this.currentPanel = 'transfer';
        this.services = {};
        this.components = {};
        this.logger = new Logger();
        this.notificationManager = new NotificationManager();
        this.proxyManager = new ProxyManager();
        this.themeManager = new ThemeManager(this.logger);

        this.init();
    }

    async init() {
        try {
            await this.initServices();
            this.initComponents();
            this.bindEvents();
            this.initUI();

            this.notificationManager.success('应用初始化完成', '夸克网盘转存工具已准备就绪');
        } catch (error) {
            this.notificationManager.error('初始化失败', error.message);
        }
    }

    async initServices() {
        this.services.db = new IndexedDBService();
        await this.services.db.init();
        this.services.quark = null;
    }

    initComponents() {
        this.components.transfer = new TransferPanel({
            dbService: this.services.db,
            logger: this.logger,
            notificationManager: this.notificationManager,
            onQuarkServiceNeeded: (cookie) => this.createQuarkService(cookie)
        });

        this.components.fileList = new FileList({
            dbService: this.services.db,
            logger: this.logger,
            notificationManager: this.notificationManager
        });

        this.components.settings = new Settings({
            dbService: this.services.db,
            logger: this.logger,
            notificationManager: this.notificationManager,
            onCookieTest: (cookie) => this.testCookie(cookie),
            fileListComponent: this.components.fileList
        });

        this.components.search = new SearchPanel({
            logger: this.logger,
            notificationManager: this.notificationManager,
            dbService: this.services.db,
            onQuarkServiceNeeded: (cookie) => this.createQuarkService(cookie),
            onFileTransferred: () => this.handleFileTransferred()
        });
    }

    async handleFileTransferred() {
        try {
            if (this.components.fileList?.refresh) {
                await this.components.fileList.refresh();
            }
            await this.updateStatusBar();
        } catch (error) {
            // 忽略刷新错误
        }
    }

    createQuarkService(cookie) {
        if (!cookie) {
            throw new Error('Cookie不能为空');
        }

        const options = {
            useProxy: this.proxyManager.isProxyEnabled(),
            proxyUrl: this.proxyManager.getProxyUrl()
        };

        this.services.quark = new QuarkWebService(cookie, this.logger, options);
        return this.services.quark;
    }

    async testCookie(cookie) {
        try {
            const options = {
                useProxy: this.proxyManager.isProxyEnabled(),
                proxyUrl: this.proxyManager.getProxyUrl()
            };

            const quarkService = new QuarkWebService(cookie, this.logger, options);
            const result = await quarkService.testConnection();

            if (result.success) {
                this.notificationManager.success('Cookie测试成功', 'Cookie有效，可以正常使用');
                return true;
            } else {
                this.notificationManager.error('Cookie测试失败', result.message);
                return false;
            }
        } catch (error) {
            if (this.proxyManager.isMixedContentError(error)) {
                this.proxyManager.handleMixedContentError(error);
            } else if (this.proxyManager.isCorsError(error)) {
                this.proxyManager.handleCorsError(error);
            } else {
                this.notificationManager.error('Cookie测试失败', error.message);
            }
            return false;
        }
    }

    bindEvents() {
        this.bindNavigationEvents();
        this.bindModalEvents();
        this.bindKeyboardEvents();
        this.bindNetworkEvents();
        this.bindWindowEvents();
    }

    bindNavigationEvents() {
        const navButtons = document.querySelectorAll('.quark-gui-nav-btn');
        navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const panel = e.currentTarget.dataset.panel;
                this.switchPanel(panel);
            });
        });

        const mobileNavButtons = document.querySelectorAll('.quark-gui-mobile-nav-btn');
        mobileNavButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const panel = e.currentTarget.dataset.panel;
                this.switchPanel(panel);
            });
        });

        const proxyBtn = document.getElementById('proxyBtn');
        if (proxyBtn) {
            proxyBtn.addEventListener('click', () => {
                this.proxyManager.showProxySettings();
            });
        }

        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.switchPanel('settings');
            });
        }

        const aboutBtn = document.getElementById('aboutBtn');
        if (aboutBtn) {
            aboutBtn.addEventListener('click', () => {
                this.showAboutModal();
            });
        }

        // 日志切换按钮
        const logToggleBtn = document.getElementById('logToggleBtn');
        if (logToggleBtn) {
            logToggleBtn.addEventListener('click', () => {
                this.toggleLogsPanel();
            });
        }
    }

    /**
     * 绑定模态框事件
     */
    bindModalEvents() {
        const modal = document.getElementById('modal');
        const modalClose = document.getElementById('modalClose');
        const modalCancel = document.getElementById('modalCancel');

        if (modalClose) {
            modalClose.addEventListener('click', () => {
                this.hideModal();
            });
        }

        if (modalCancel) {
            modalCancel.addEventListener('click', () => {
                this.hideModal();
            });
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal();
                }
            });
        }
    }

    /**
     * 绑定键盘事件
     */
    bindKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            // ESC键关闭模态框
            if (e.key === 'Escape') {
                this.hideModal();
            }
            
            // Ctrl+S 保存设置
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                if (this.currentPanel === 'settings') {
                    this.components.settings.saveSettings();
                }
            }
            
            // Ctrl+R 刷新文件列表
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                if (this.currentPanel === 'files') {
                    this.components.fileList.refresh();
                }
            }
        });
    }

    /**
     * 绑定网络状态事件
     */
    bindNetworkEvents() {
        window.addEventListener('online', () => {
            this.updateNetworkStatus(true);
            this.notificationManager.success('网络已连接', '网络连接已恢复');
        });

        window.addEventListener('offline', () => {
            this.updateNetworkStatus(false);
            this.notificationManager.warning('网络已断开', '请检查网络连接');
        });
    }

    /**
     * 绑定窗口事件
     */
    bindWindowEvents() {
        // 窗口大小变化
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // 页面卸载前保存数据
        window.addEventListener('beforeunload', (e) => {
            this.handleBeforeUnload(e);
        });
    }

    /**
     * 初始化界面
     */
    initUI() {
        this.updateStatusBar();
        this.switchPanel('transfer');
        this.updateNetworkStatus(navigator.onLine);
        this.handleResize();
        this.loadSettings();
    }

    /**
     * 切换面板
     */
    switchPanel(panelName) {
        const panels = document.querySelectorAll('.quark-gui-panel');
        panels.forEach(panel => {
            panel.classList.remove('active');
        });

        const targetPanel = document.getElementById(`${panelName}Panel`);
        if (targetPanel) {
            targetPanel.classList.add('active');
        }

        const navButtons = document.querySelectorAll('.quark-gui-nav-btn, .quark-gui-mobile-nav-btn');
        navButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.panel === panelName) {
                btn.classList.add('active');
            }
        });

        this.currentPanel = panelName;
        this.onPanelActivated(panelName);
    }

    /**
     * 面板激活回调
     */
    onPanelActivated(panelName) {
        switch (panelName) {
            case 'files':
                this.components.fileList.onActivated();
                break;
            case 'settings':
                this.components.settings.onActivated();
                break;
            case 'transfer':
                this.components.transfer.onActivated();
                break;
            case 'search':
                this.components.search.onActivated();
                break;
        }
    }

    /**
     * 显示模态框
     */
    showModal(title, content, options = {}) {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        const modalFooter = document.getElementById('modalFooter');
        const modalConfirm = document.getElementById('modalConfirm');

        if (modalTitle) modalTitle.textContent = title;
        if (modalBody) modalBody.innerHTML = content;
        
        // 配置确认按钮
        if (modalConfirm) {
            modalConfirm.textContent = options.confirmText || '确定';
            modalConfirm.onclick = options.onConfirm || (() => this.hideModal());
        }

        // 显示/隐藏底部按钮
        if (modalFooter) {
            modalFooter.style.display = options.hideFooter ? 'none' : 'flex';
        }

        if (modal) {
            modal.style.display = 'flex';
        }
    }

    /**
     * 隐藏模态框
     */
    hideModal() {
        const modal = document.getElementById('modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * 显示关于对话框
     */
    showAboutModal() {
        const content = `
            <div style="text-align: center;">
                <h3>夸克网盘转存工具 - Web版</h3>
                <p>版本: v1.0.0</p>
                <p>基于Web技术构建的夸克网盘文件转存工具</p>
                <br>
                <p><strong>主要功能:</strong></p>
                <ul style="text-align: left; display: inline-block;">
                    <li>文件转存：从分享链接转存文件到个人网盘</li>
                    <li>分享链接生成：自动为转存文件创建新的分享链接</li>
                    <li>重复检测：避免重复转存相同文件</li>
                    <li>文件管理：搜索、删除、列表等功能</li>
                    <li>数据持久化：本地IndexedDB数据库存储</li>
                </ul>
                <br>
                <p><strong>技术栈:</strong></p>
                <p>HTML5 + CSS3 + JavaScript (ES6+) + IndexedDB</p>
                <br>
                <p style="color: #666; font-size: 12px;">
                    本工具仅供学习交流使用，请遵守相关法律法规
                </p>
            </div>
        `;
        
        this.showModal('关于', content, { hideFooter: true });
    }

    /**
     * 更新状态栏
     */
    async updateStatusBar() {
        try {
            // 更新文件数量
            const totalFiles = await this.services.db.getFileCount();
            const totalFilesElement = document.getElementById('totalFiles');
            if (totalFilesElement) {
                totalFilesElement.textContent = totalFiles;
            }

            // 更新数据库状态
            const dbStatusElement = document.getElementById('dbStatus');
            if (dbStatusElement) {
                dbStatusElement.textContent = '正常';
                dbStatusElement.style.color = 'var(--quark-success-color)';
            }
        } catch (error) {
            const dbStatusElement = document.getElementById('dbStatus');
            if (dbStatusElement) {
                dbStatusElement.textContent = '异常';
                dbStatusElement.style.color = 'var(--quark-error-color)';
            }
        }
    }

    /**
     * 更新网络状态
     */
    updateNetworkStatus(isOnline) {
        const networkStatusElement = document.getElementById('networkStatus');
        if (networkStatusElement) {
            networkStatusElement.textContent = isOnline ? '在线' : '离线';
            networkStatusElement.style.color = isOnline ? 
                'var(--quark-success-color)' : 'var(--quark-error-color)';
        }
    }

    /**
     * 处理窗口大小变化
     */
    handleResize() {
        const width = window.innerWidth;

        // 根据屏幕宽度调整布局
        if (width <= 768) {
            this.enableMobileMode();
        } else {
            this.disableMobileMode();
        }

        // 更新表格容器滚动
        this.updateTableContainers();

        // 通知组件更新布局
        this.notifyComponentsResize();
    }

    /**
     * 启用移动端模式
     */
    enableMobileMode() {
        const mobileNav = document.getElementById('mobileNav');
        const sidebar = document.querySelector('.quark-gui-sidebar');
        const logs = document.querySelector('.quark-gui-logs');

        // 显示移动端导航
        if (mobileNav) {
            mobileNav.style.display = 'flex';
        }

        // 隐藏桌面端侧边栏
        if (sidebar) {
            sidebar.style.display = 'none';
        }

        // 调整日志面板为全屏模式
        if (logs && logs.classList.contains('show')) {
            logs.style.position = 'fixed';
            logs.style.top = 'var(--quark-header-height)';
            logs.style.left = '0';
            logs.style.right = '0';
            logs.style.bottom = '60px'; // 为移动端导航留空间
            logs.style.width = '100vw';
            logs.style.zIndex = '1000';
        }

        this.logger.info('启用移动端模式');
    }

    /**
     * 禁用移动端模式
     */
    disableMobileMode() {
        const mobileNav = document.getElementById('mobileNav');
        const sidebar = document.querySelector('.quark-gui-sidebar');
        const logs = document.querySelector('.quark-gui-logs');

        // 隐藏移动端导航
        if (mobileNav) {
            mobileNav.style.display = 'none';
        }

        // 显示桌面端侧边栏
        if (sidebar) {
            sidebar.style.display = 'block';
        }

        // 恢复日志面板正常模式
        if (logs) {
            logs.style.position = '';
            logs.style.top = '';
            logs.style.left = '';
            logs.style.right = '';
            logs.style.bottom = '';
            logs.style.width = '';
            logs.style.zIndex = '';
        }

        this.logger.info('禁用移动端模式');
    }

    /**
     * 更新表格容器滚动
     */
    updateTableContainers() {
        const tableContainers = document.querySelectorAll('.quark-gui-table-container');
        tableContainers.forEach(container => {
            // 确保表格容器在小屏幕上可以正常滚动
            if (window.innerWidth <= 768) {
                container.style.overflowX = 'auto';
                container.style.webkitOverflowScrolling = 'touch';
            }
        });
    }

    /**
     * 通知组件更新布局
     */
    notifyComponentsResize() {
        // 通知文件列表组件更新布局
        if (this.components.fileList && typeof this.components.fileList.handleResize === 'function') {
            this.components.fileList.handleResize();
        }

        // 通知其他组件
        Object.values(this.components).forEach(component => {
            if (component && typeof component.handleResize === 'function') {
                component.handleResize();
            }
        });
    }

    /**
     * 页面卸载前处理
     */
    handleBeforeUnload(e) {
        // 如果有未保存的数据，提示用户
        if (this.hasUnsavedChanges()) {
            e.preventDefault();
            e.returnValue = '您有未保存的更改，确定要离开吗？';
        }
    }

    /**
     * 检查是否有未保存的更改
     */
    hasUnsavedChanges() {
        // 检查各个组件是否有未保存的更改
        return this.components.settings?.hasUnsavedChanges() || false;
    }

    /**
     * 加载保存的设置
     */
    async loadSettings() {
        try {
            await this.components.settings.loadSettings();
        } catch (error) {
            // 忽略设置加载错误
        }
    }

    /**
     * 处理从搜索面板发起的转存请求
     * @param {string} link - 分享链接
     * @param {string} name - 文件名
     */
    handleTransferFromSearch(link, name) {
        try {
            // 填充转存表单
            const shareUrlInput = document.getElementById('shareUrl');
            if (shareUrlInput) {
                shareUrlInput.value = link;

                // 触发输入事件以更新UI状态
                shareUrlInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // 切换到转存面板
            this.switchPanel('transfer');

            // 显示成功提示
            this.notificationManager.success('链接已填入', `已将"${name}"的分享链接填入转存表单`);

            this.logger.info(`从搜索面板转存文件: ${name}`);

        } catch (error) {
            this.logger.error('处理转存请求失败:', error.message);
            this.notificationManager.error('操作失败', error.message);
        }
    }

    /**
     * 切换日志面板显示状态
     */
    toggleLogsPanel() {
        const logsPanel = document.getElementById('logsPanel');
        const logToggleBtn = document.getElementById('logToggleBtn');

        if (!logsPanel || !logToggleBtn) return;

        const isVisible = logsPanel.classList.contains('show');

        if (isVisible) {
            logsPanel.classList.remove('show');
            logToggleBtn.innerHTML = '<span class="quark-gui-icon">📋</span> 日志';
            this.logger.info('日志面板已隐藏');
        } else {
            logsPanel.classList.add('show');
            logToggleBtn.innerHTML = '<span class="quark-gui-icon">📋</span> 收起';
            this.logger.info('日志面板已显示');
        }
    }

}

// 应用启动
document.addEventListener('DOMContentLoaded', () => {
    window.quarkApp = new QuarkGUIApp();
});

// 导出应用类供其他模块使用
export default QuarkGUIApp;
