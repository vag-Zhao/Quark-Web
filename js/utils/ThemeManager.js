/**
 * 主题管理器
 * 负责管理亮色/暗色主题的切换和持久化
 */

export class ThemeManager {
    /**
     * 构造函数
     * @param {Object} logger - 日志记录器
     */
    constructor(logger) {
        this.logger = logger;
        this.currentTheme = 'light';
        this.themeToggleBtn = null;
        this.themeIcon = null;
        
        // 主题图标映射
        this.themeIcons = {
            light: '🌙', // 亮色模式显示月亮图标（点击切换到暗色）
            dark: '☀️'   // 暗色模式显示太阳图标（点击切换到亮色）
        };
        
        this.init();
    }

    /**
     * 初始化主题管理器
     */
    init() {
        this.logger.info('初始化主题管理器...');
        
        // 获取DOM元素
        this.themeToggleBtn = document.getElementById('themeToggle');
        this.themeIcon = document.querySelector('.quark-gui-theme-icon');
        
        if (!this.themeToggleBtn || !this.themeIcon) {
            this.logger.error('主题切换按钮或图标元素未找到');
            return;
        }
        
        // 绑定事件
        this.bindEvents();
        
        // 加载保存的主题
        this.loadSavedTheme();
        
        this.logger.info('主题管理器初始化完成');
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        this.themeToggleBtn.addEventListener('click', () => {
            this.toggleTheme();
        });
        
        // 监听系统主题变化
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', (e) => {
                // 只有在用户没有手动设置主题时才跟随系统
                if (!localStorage.getItem('quark-gui-theme')) {
                    this.setTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    }

    /**
     * 加载保存的主题
     */
    loadSavedTheme() {
        try {
            // 优先使用用户保存的主题
            const savedTheme = localStorage.getItem('quark-gui-theme');
            
            if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
                this.setTheme(savedTheme);
                this.logger.info(`加载保存的主题: ${savedTheme}`);
            } else {
                // 如果没有保存的主题，检查系统偏好
                const prefersDark = window.matchMedia && 
                                  window.matchMedia('(prefers-color-scheme: dark)').matches;
                this.setTheme(prefersDark ? 'dark' : 'light');
                this.logger.info(`使用系统主题偏好: ${prefersDark ? 'dark' : 'light'}`);
            }
        } catch (error) {
            this.logger.error('加载主题设置失败:', error.message);
            this.setTheme('light'); // 默认使用亮色主题
        }
    }

    /**
     * 切换主题
     */
    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
        this.saveTheme(newTheme);
        
        this.logger.info(`主题已切换到: ${newTheme}`);
    }

    /**
     * 设置主题
     * @param {string} theme - 主题名称 ('light' 或 'dark')
     */
    setTheme(theme) {
        if (theme !== 'light' && theme !== 'dark') {
            this.logger.warn(`无效的主题名称: ${theme}`);
            return;
        }
        
        this.currentTheme = theme;
        
        // 更新HTML的data-theme属性
        document.documentElement.setAttribute('data-theme', theme);
        
        // 更新按钮图标
        this.updateThemeIcon();
        
        // 更新按钮标题
        this.updateButtonTitle();
        
        // 触发主题变化事件
        this.dispatchThemeChangeEvent(theme);
    }

    /**
     * 更新主题图标
     */
    updateThemeIcon() {
        if (this.themeIcon) {
            this.themeIcon.textContent = this.themeIcons[this.currentTheme];
        }
    }

    /**
     * 更新按钮标题
     */
    updateButtonTitle() {
        if (this.themeToggleBtn) {
            const title = this.currentTheme === 'light' ? 
                         '切换到暗色模式' : '切换到亮色模式';
            this.themeToggleBtn.setAttribute('title', title);
        }
    }

    /**
     * 保存主题到localStorage
     * @param {string} theme - 主题名称
     */
    saveTheme(theme) {
        try {
            localStorage.setItem('quark-gui-theme', theme);
            this.logger.debug(`主题已保存: ${theme}`);
        } catch (error) {
            this.logger.error('保存主题设置失败:', error.message);
        }
    }

    /**
     * 触发主题变化事件
     * @param {string} theme - 新主题名称
     */
    dispatchThemeChangeEvent(theme) {
        const event = new CustomEvent('themechange', {
            detail: { theme: theme }
        });
        document.dispatchEvent(event);
    }

    /**
     * 获取当前主题
     * @returns {string} 当前主题名称
     */
    getCurrentTheme() {
        return this.currentTheme;
    }

    /**
     * 检查是否为暗色主题
     * @returns {boolean} 是否为暗色主题
     */
    isDarkTheme() {
        return this.currentTheme === 'dark';
    }

    /**
     * 检查是否为亮色主题
     * @returns {boolean} 是否为亮色主题
     */
    isLightTheme() {
        return this.currentTheme === 'light';
    }

    /**
     * 重置主题为系统默认
     */
    resetToSystemTheme() {
        localStorage.removeItem('quark-gui-theme');
        const prefersDark = window.matchMedia && 
                          window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.setTheme(prefersDark ? 'dark' : 'light');
        this.logger.info('主题已重置为系统默认');
    }

    /**
     * 销毁主题管理器
     */
    destroy() {
        if (this.themeToggleBtn) {
            this.themeToggleBtn.removeEventListener('click', this.toggleTheme);
        }
        this.logger.info('主题管理器已销毁');
    }
}

export default ThemeManager;
