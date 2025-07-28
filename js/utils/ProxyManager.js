/**
 * 代理管理器
 * 处理CORS代理相关功能
 */

export class ProxyManager {
    constructor() {
        this.proxyUrl = this.getDefaultProxyUrl();
        this.isProxyAvailable = false;
        this.checkInterval = null;
    }

    /**
     * 获取默认代理URL
     * @returns {string} 代理URL
     */
    getDefaultProxyUrl() {
        // 从localStorage获取自定义代理URL
        const customProxyUrl = localStorage.getItem('quark-gui-proxy-url');
        if (customProxyUrl) {
            return customProxyUrl;
        }

        // 根据当前域名自动判断代理URL
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;

        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            // 本地开发环境
            return 'http://localhost:8081';
        } else {
            // 生产环境处理Mixed Content问题
            if (protocol === 'https:') {
                // HTTPS环境下，强制使用HTTP代理（临时修复）
                console.warn('HTTPS环境检测到，强制使用HTTP代理');
                return `http://${hostname}:8081`;
            } else {
                // HTTP环境，直接使用HTTP代理
                return `http://${hostname}:8081`;
            }
        }
    }

    /**
     * 检查代理服务器是否可用
     * @returns {Promise<boolean>} 是否可用
     */
    async checkProxyAvailability() {
        try {
            const response = await fetch(`${this.proxyUrl}/health`, {
                method: 'GET',
                timeout: 5000
            });
            
            this.isProxyAvailable = response.ok;
            return this.isProxyAvailable;
        } catch (error) {
            this.isProxyAvailable = false;
            return false;
        }
    }

    /**
     * 启动代理检查
     */
    startProxyCheck() {
        // 立即检查一次
        this.checkProxyAvailability();
        
        // 每30秒检查一次
        this.checkInterval = setInterval(() => {
            this.checkProxyAvailability();
        }, 30000);
    }

    /**
     * 停止代理检查
     */
    stopProxyCheck() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    /**
     * 获取代理状态
     * @returns {Object} 代理状态信息
     */
    getProxyStatus() {
        return {
            url: this.proxyUrl,
            available: this.isProxyAvailable,
            enabled: this.isProxyEnabled()
        };
    }

    /**
     * 检查是否启用代理
     * @returns {boolean} 是否启用
     */
    isProxyEnabled() {
        return localStorage.getItem('quark-gui-proxy-enabled') === 'true';
    }

    /**
     * 检查是否为Mixed Content错误
     * @param {Error} error - 错误对象
     * @returns {boolean} 是否为Mixed Content错误
     */
    isMixedContentError(error) {
        const message = error.message || error.toString();
        return message.includes('Mixed Content') ||
               message.includes('blocked:mixed-content') ||
               message.includes('insecure resource');
    }

    /**
     * 处理Mixed Content错误
     * @param {Error} error - 错误对象
     */
    handleMixedContentError(error) {
        console.warn('检测到Mixed Content错误:', error.message);

        // 显示Mixed Content解决方案
        this.showMixedContentHelp();
    }

    /**
     * 启用代理
     */
    enableProxy() {
        localStorage.setItem('quark-gui-proxy-enabled', 'true');
    }

    /**
     * 禁用代理
     */
    disableProxy() {
        localStorage.setItem('quark-gui-proxy-enabled', 'false');
    }

    /**
     * 获取代理URL
     * @returns {string} 代理URL
     */
    getProxyUrl() {
        return this.proxyUrl;
    }

    /**
     * 设置代理URL
     * @param {string} url - 代理URL
     */
    setProxyUrl(url) {
        this.proxyUrl = url;
        localStorage.setItem('quark-gui-proxy-url', url);
    }

    /**
     * 获取代理URL
     * @returns {string} 代理URL
     */
    getProxyUrl() {
        return localStorage.getItem('quark-gui-proxy-url') || this.proxyUrl;
    }

    /**
     * 显示代理设置界面
     */
    showProxySettings() {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        const modalConfirm = document.getElementById('modalConfirm');

        if (modalTitle) modalTitle.textContent = '代理设置';
        
        if (modalBody) {
            modalBody.innerHTML = `
                <div class="proxy-settings">
                    <div class="quark-gui-form-group">
                        <label for="proxyUrl">代理服务器地址</label>
                        <input type="text" id="proxyUrl" class="quark-gui-input" 
                               value="${this.getProxyUrl()}" 
                               placeholder="http://localhost:8081">
                        <small class="quark-gui-help-text">
                            请确保代理服务器正在运行
                        </small>
                    </div>
                    
                    <div class="quark-gui-form-group">
                        <label>
                            <input type="checkbox" id="enableProxy" 
                                   ${this.isProxyEnabled() ? 'checked' : ''}> 
                            启用代理服务器
                        </label>
                        <small class="quark-gui-help-text">
                            启用后将通过代理服务器发送请求，解决CORS问题
                        </small>
                    </div>
                    
                    <div class="proxy-status">
                        <h4>代理状态</h4>
                        <p>状态: <span id="proxyStatusText">${this.isProxyAvailable ? '可用' : '不可用'}</span></p>
                        <button class="quark-gui-btn quark-gui-btn-secondary" id="testProxyBtn">
                            测试连接
                        </button>
                    </div>
                    
                    <div class="proxy-help">
                        <h4>使用说明</h4>
                        <ol>
                            <li>下载并运行代理服务器: <code>node proxy-server.js</code></li>
                            <li>确保代理服务器在 ${this.proxyUrl} 运行</li>
                            <li>启用代理设置</li>
                            <li>测试连接确保正常工作</li>
                        </ol>
                    </div>
                </div>
            `;
        }

        // 绑定事件
        const testProxyBtn = document.getElementById('testProxyBtn');
        if (testProxyBtn) {
            testProxyBtn.addEventListener('click', async () => {
                testProxyBtn.disabled = true;
                testProxyBtn.textContent = '测试中...';
                
                const available = await this.checkProxyAvailability();
                const statusText = document.getElementById('proxyStatusText');
                if (statusText) {
                    statusText.textContent = available ? '可用' : '不可用';
                    statusText.style.color = available ? 'green' : 'red';
                }
                
                testProxyBtn.disabled = false;
                testProxyBtn.textContent = '测试连接';
            });
        }

        if (modalConfirm) {
            modalConfirm.textContent = '保存设置';
            modalConfirm.onclick = () => {
                this.saveProxySettings();
                modal.style.display = 'none';
            };
        }

        if (modal) {
            modal.style.display = 'flex';
        }
    }

    /**
     * 保存代理设置
     */
    saveProxySettings() {
        const proxyUrlInput = document.getElementById('proxyUrl');
        const enableProxyCheckbox = document.getElementById('enableProxy');

        if (proxyUrlInput) {
            this.setProxyUrl(proxyUrlInput.value.trim());
        }

        if (enableProxyCheckbox) {
            if (enableProxyCheckbox.checked) {
                this.enableProxy();
            } else {
                this.disableProxy();
            }
        }

        // 重新检查代理状态
        this.checkProxyAvailability();
    }

    /**
     * 显示Mixed Content错误帮助
     */
    showMixedContentHelp() {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');

        if (modalTitle) modalTitle.textContent = 'Mixed Content 错误解决方案';

        if (modalBody) {
            modalBody.innerHTML = `
                <div class="mixed-content-help">
                    <div class="alert alert-warning">
                        <h4>⚠️ Mixed Content 错误</h4>
                        <p>HTTPS网站无法加载HTTP资源，这是浏览器的安全限制。</p>
                    </div>

                    <h4>解决方案：</h4>

                    <div class="solution-option">
                        <h5>方案一：允许不安全内容（推荐）</h5>
                        <ol>
                            <li>点击浏览器地址栏右侧的盾牌图标 🛡️</li>
                            <li>选择"加载不安全脚本"或"允许不安全内容"</li>
                            <li>刷新页面</li>
                        </ol>
                    </div>

                    <div class="solution-option">
                        <h5>方案二：强制使用HTTP代理</h5>
                        <p>点击下面的按钮强制使用HTTP代理（可能显示安全警告）：</p>
                        <button class="quark-gui-btn quark-gui-btn-warning" id="forceHttpProxyBtn">
                            强制使用HTTP代理
                        </button>
                    </div>

                    <div class="solution-option">
                        <h5>方案三：使用HTTP访问</h5>
                        <p>将网址改为HTTP协议访问：</p>
                        <code>http://${window.location.hostname}</code>
                        <button class="quark-gui-btn quark-gui-btn-secondary" id="switchToHttpBtn">
                            切换到HTTP
                        </button>
                    </div>
                </div>
            `;
        }

        // 绑定事件
        const forceHttpProxyBtn = document.getElementById('forceHttpProxyBtn');
        if (forceHttpProxyBtn) {
            forceHttpProxyBtn.addEventListener('click', () => {
                localStorage.setItem('quark-gui-force-http-proxy', 'true');
                window.location.reload();
            });
        }

        const switchToHttpBtn = document.getElementById('switchToHttpBtn');
        if (switchToHttpBtn) {
            switchToHttpBtn.addEventListener('click', () => {
                const httpUrl = window.location.href.replace('https://', 'http://');
                window.location.href = httpUrl;
            });
        }

        if (modal) {
            modal.style.display = 'block';
        }
    }

    /**
     * 显示CORS错误提示
     */
    showCorsErrorHelp() {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');

        if (modalTitle) modalTitle.textContent = 'CORS错误解决方案';
        
        if (modalBody) {
            modalBody.innerHTML = `
                <div class="cors-help">
                    <p>检测到CORS（跨域资源共享）错误。这是因为浏览器安全策略阻止了跨域请求。</p>
                    
                    <h4>解决方案：</h4>
                    
                    <div class="solution">
                        <h5>方案一：使用代理服务器（推荐）</h5>
                        <ol>
                            <li>确保已安装Node.js</li>
                            <li>在项目目录运行: <code>node proxy-server.js</code></li>
                            <li>在设置中启用代理服务器</li>
                            <li>重新尝试操作</li>
                        </ol>
                        <button class="quark-gui-btn quark-gui-btn-primary" id="openProxySettings">
                            配置代理服务器
                        </button>
                    </div>
                    
                    <div class="solution">
                        <h5>方案二：使用Web服务器</h5>
                        <ol>
                            <li>将文件部署到Web服务器（如Apache、Nginx）</li>
                            <li>通过HTTP/HTTPS访问，而不是file://协议</li>
                            <li>确保服务器支持CORS</li>
                        </ol>
                    </div>
                    
                    <div class="solution">
                        <h5>方案三：浏览器扩展</h5>
                        <ol>
                            <li>安装CORS解除扩展（如CORS Unblock）</li>
                            <li>启用扩展</li>
                            <li>重新尝试操作</li>
                        </ol>
                        <p class="warning">⚠️ 注意：此方案可能存在安全风险</p>
                    </div>
                </div>
            `;
        }

        // 绑定事件
        const openProxySettingsBtn = document.getElementById('openProxySettings');
        if (openProxySettingsBtn) {
            openProxySettingsBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                setTimeout(() => this.showProxySettings(), 100);
            });
        }

        if (modal) {
            modal.style.display = 'flex';
        }
    }

    /**
     * 检测CORS错误
     * @param {Error} error - 错误对象
     * @returns {boolean} 是否为CORS错误
     */
    isCorsError(error) {
        const corsKeywords = [
            'CORS',
            'Cross-Origin',
            'Access-Control-Allow-Origin',
            'blocked by CORS policy'
        ];
        
        return corsKeywords.some(keyword => 
            error.message.includes(keyword)
        );
    }

    /**
     * 处理CORS错误
     * @param {Error} error - 错误对象
     */
    handleCorsError(error) {
        if (this.isCorsError(error)) {
            this.showCorsErrorHelp();
        }
    }
}

export default ProxyManager;
