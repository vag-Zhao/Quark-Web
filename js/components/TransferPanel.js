import { isValidQuarkUrl } from '../utils/urlUtils.js';

export class TransferPanel {
    constructor(options) {
        this.dbService = options.dbService;
        this.logger = options.logger;
        this.notificationManager = options.notificationManager;
        this.onQuarkServiceNeeded = options.onQuarkServiceNeeded;

        this.isTransferring = false;
        this.currentStep = 0;
        this.totalSteps = 5;
        this.isBatchMode = false;
        this.detectedLinks = [];
        this.batchResults = [];

        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSavedData();
    }

    bindEvents() {
        const transferBtn = document.getElementById('transferBtn');
        if (transferBtn) {
            transferBtn.addEventListener('click', () => this.handleTransfer());
        }

        const clearBtn = document.getElementById('clearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearForm());
        }

        const shareUrlInput = document.getElementById('shareUrl');
        if (shareUrlInput) {
            shareUrlInput.addEventListener('input', (e) => this.validateUrl(e.target.value));
            shareUrlInput.addEventListener('paste', (e) => {
                setTimeout(() => this.validateUrl(e.target.value), 10);
            });
        }

        this.bindBatchEvents();
    }

    validateUrl(url) {
        const transferBtn = document.getElementById('transferBtn');

        if (!url.trim()) {
            this.removeUrlValidation();
            return;
        }

        if (isValidQuarkUrl(url)) {
            this.showUrlValidation(true, '链接格式正确');
            if (transferBtn) transferBtn.disabled = false;
        } else {
            this.showUrlValidation(false, '请输入有效的夸克网盘分享链接');
            if (transferBtn) transferBtn.disabled = true;
        }
    }

    showUrlValidation(isValid, message) {
        const shareUrlInput = document.getElementById('shareUrl');
        if (!shareUrlInput) return;

        this.removeUrlValidation();

        shareUrlInput.style.borderColor = isValid ? 'var(--quark-success-color)' : 'var(--quark-error-color)';

        const validationMsg = document.createElement('small');
        validationMsg.className = 'quark-gui-validation-message';
        validationMsg.style.color = isValid ? 'var(--quark-success-color)' : 'var(--quark-error-color)';
        validationMsg.textContent = message;

        shareUrlInput.parentNode.appendChild(validationMsg);
    }

    removeUrlValidation() {
        const shareUrlInput = document.getElementById('shareUrl');
        if (shareUrlInput) {
            shareUrlInput.style.borderColor = '';

            const existingMsg = shareUrlInput.parentNode.querySelector('.quark-gui-validation-message');
            if (existingMsg) {
                existingMsg.remove();
            }
        }
    }

    async handleTransfer() {
        if (this.isTransferring) return;

        if (this.isBatchMode) {
            await this.handleBatchTransfer();
        } else {
            await this.handleSingleTransfer();
        }
    }

    async handleSingleTransfer() {
        const shareUrl = document.getElementById('shareUrl')?.value.trim();

        if (!shareUrl) {
            this.notificationManager.warning('输入错误', '请输入分享链接');
            return;
        }

        if (!isValidQuarkUrl(shareUrl)) {
            this.notificationManager.error('链接无效', '请输入有效的夸克网盘分享链接');
            return;
        }

        try {
            this.isTransferring = true;
            this.showProgress(true);
            this.updateTransferButton(true);

            const cookie = await this.getDefaultCookie();
            if (!cookie) {
                throw new Error('请先在设置中配置Cookie');
            }

            const quarkService = this.onQuarkServiceNeeded(cookie);

            const fileName = await this.extractFileName(shareUrl, quarkService);
            if (fileName) {
                const duplicateCheck = await this.dbService.checkDuplicate(fileName, shareUrl);
                if (duplicateCheck.exists) {
                    const duplicateTypeText = duplicateCheck.duplicateType === 'both' ? '文件名和链接都' :
                                            duplicateCheck.duplicateType === 'name' ? '文件名' : '链接';

                    this.showResult(false, {
                        message: `重复文件，已跳过`,
                        skipped: true,
                        duplicateType: duplicateTypeText
                    });
                    this.notificationManager.info('重复文件', `文件 "${fileName}" 已存在（${duplicateTypeText}重复），已跳过转存`);
                    this.resetTransferState();
                    return;
                }
            }

            const result = await quarkService.store(shareUrl, (step, message, progress) => {
                this.updateProgress(step, message, progress);
            });

            if (result.success) {
                await this.dbService.insertFile(
                    result.data.fileId,
                    result.data.fileName,
                    result.data.fileType,
                    result.data.shareLink
                );

                this.showResult(true, result);
                this.notificationManager.success('转存成功', `文件 "${result.data.fileName}" 已成功转存`);
                this.clearForm();
            } else {
                this.showResult(false, result);
                this.notificationManager.error('转存失败', result.message);
            }

        } catch (error) {
            this.showResult(false, { message: error.message });
            this.notificationManager.error('转存失败', error.message);
        } finally {
            this.resetTransferState();
        }
    }

    async handleBatchTransfer() {
        if (this.detectedLinks.length === 0) {
            this.notificationManager.warning('输入错误', '未检测到有效的夸克网盘链接');
            return;
        }

        try {
            this.isTransferring = true;
            this.batchResults = [];
            this.showProgress(true);
            this.updateTransferButton(true);

            const cookie = await this.getDefaultCookie();
            if (!cookie) {
                throw new Error('请先在设置中配置Cookie');
            }

            const quarkService = this.onQuarkServiceNeeded(cookie);
            const totalLinks = this.detectedLinks.length;
            let successCount = 0;
            let failCount = 0;
            let skipCount = 0;

            for (let i = 0; i < totalLinks; i++) {
                const link = this.detectedLinks[i];
                const currentProgress = Math.round(((i + 1) / totalLinks) * 100);

                this.updateProgress(
                    1,
                    `正在转存第 ${i + 1}/${totalLinks} 个文件...`,
                    currentProgress
                );

                try {
                    const fileName = await this.extractFileName(link, quarkService);
                    if (fileName) {
                        const duplicateCheck = await this.dbService.checkDuplicate(fileName, link);
                        if (duplicateCheck.exists) {
                            const duplicateTypeText = duplicateCheck.duplicateType === 'both' ? '文件名和链接都' :
                                                    duplicateCheck.duplicateType === 'name' ? '文件名' : '链接';
                            this.batchResults.push({
                                link,
                                success: false,
                                message: `文件 "${fileName}" 已存在（${duplicateTypeText}重复），跳过转存`,
                                skipped: true,
                                duplicateType: duplicateTypeText,
                                fileName: fileName
                            });
                            skipCount++;
                            continue;
                        }
                    }

                    const result = await quarkService.store(link);

                    if (result.success) {
                        await this.dbService.insertFile(
                            result.data.fileId,
                            result.data.fileName,
                            result.data.fileType,
                            result.data.shareLink
                        );

                        this.batchResults.push({
                            link,
                            success: true,
                            data: result.data
                        });
                        successCount++;
                    } else {
                        this.batchResults.push({
                            link,
                            success: false,
                            message: result.message
                        });
                        failCount++;
                    }
                } catch (error) {
                    this.batchResults.push({
                        link,
                        success: false,
                        message: error.message
                    });
                    failCount++;
                }

                if (i < totalLinks - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            // 显示批量转存结果
            this.showBatchResult(successCount, failCount, skipCount, totalLinks);

            // 构建结果消息
            let resultMessage = `成功转存 ${successCount} 个文件`;
            if (failCount > 0) {
                resultMessage += `，失败 ${failCount} 个`;
            }
            if (skipCount > 0) {
                resultMessage += `，跳过重复文件 ${skipCount} 个`;
            }

            if (successCount > 0) {
                this.notificationManager.success('批量转存完成', resultMessage);
            } else if (skipCount > 0 && failCount === 0) {
                this.notificationManager.info('批量转存完成', `所有文件都是重复文件，已跳过 ${skipCount} 个`);
            } else {
                this.notificationManager.error('批量转存失败', '所有文件转存都失败了');
            }

        } catch (error) {
            this.showResult(false, { message: error.message });
            this.notificationManager.error('批量转存失败', error.message);
            this.logger.error('批量转存过程出错:', error.message);
        } finally {
            this.resetTransferState();
        }
    }

    /**
     * 提取文件名（用于重复检查）
     * @param {string} url - 分享链接
     * @param {Object} quarkService - 夸克服务
     * @returns {Promise<string>} 文件名
     */
    async extractFileName(url, quarkService) {
        try {
            const fileInfo = await quarkService.getFileInfo(url);
            return fileInfo?.fileName || null;
        } catch (error) {
            return null;
        }
    }

    /**
     * 确认重复文件处理
     * @param {string} fileName - 文件名
     * @param {string} duplicateType - 重复类型 ('name', 'link', 'both')
     * @returns {Promise<boolean>} 是否继续
     */
    async confirmDuplicate(fileName, duplicateType = 'name') {
        return new Promise((resolve) => {
            const modal = document.getElementById('modal');
            const modalTitle = document.getElementById('modalTitle');
            const modalBody = document.getElementById('modalBody');
            const modalConfirm = document.getElementById('modalConfirm');
            const modalCancel = document.getElementById('modalCancel');

            if (modalTitle) modalTitle.textContent = '检测到重复文件';

            let duplicateMessage = '';
            switch (duplicateType) {
                case 'both':
                    duplicateMessage = '文件名和分享链接都已存在于数据库中';
                    break;
                case 'link':
                    duplicateMessage = '该分享链接已存在于数据库中';
                    break;
                case 'name':
                default:
                    duplicateMessage = '相同文件名已存在于数据库中';
                    break;
            }

            if (modalBody) {
                modalBody.innerHTML = `
                    <p>文件 "<strong>${fileName}</strong>" 检测到重复：</p>
                    <p><strong>${duplicateMessage}</strong></p>
                    <p>是否要重新转存？重新转存将创建新的记录。</p>
                `;
            }

            if (modalConfirm) {
                modalConfirm.textContent = '重新转存';
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
     * 获取默认Cookie
     * @returns {Promise<string>} Cookie字符串
     */
    async getDefaultCookie() {
        try {
            const settings = JSON.parse(localStorage.getItem('quark-gui-settings') || '{}');
            return settings.defaultCookie || '';
        } catch (error) {
            return '';
        }
    }



    /**
     * 显示进度
     * @param {boolean} show - 是否显示
     */
    showProgress(show) {
        const progressSection = document.getElementById('progressSection');
        if (progressSection) {
            progressSection.style.display = show ? 'block' : 'none';
        }

        if (show) {
            this.resetProgress();
        }
    }

    /**
     * 重置进度
     */
    resetProgress() {
        this.currentStep = 0;
        this.updateProgress(0, '准备中...', 0);
        
        // 重置所有步骤状态
        const steps = document.querySelectorAll('.quark-gui-step');
        steps.forEach(step => {
            step.classList.remove('active', 'completed', 'error');
        });
    }

    /**
     * 更新进度
     * @param {number} step - 当前步骤
     * @param {string} message - 状态消息
     * @param {number} progress - 进度百分比
     */
    updateProgress(step, message, progress) {
        // 更新状态文本
        const progressStatus = document.getElementById('progressStatus');
        if (progressStatus) {
            progressStatus.textContent = message;
        }

        // 更新进度条
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }

        // 更新步骤状态
        if (step > 0) {
            this.updateStepStatus(step, message);
        }

        // 如果是错误步骤
        if (step === -1) {
            this.updateStepStatus(this.currentStep, message, 'error');
        }
    }

    /**
     * 更新步骤状态
     * @param {number} stepNumber - 步骤号
     * @param {string} message - 消息
     * @param {string} status - 状态 (active, completed, error)
     */
    updateStepStatus(stepNumber, message, status = 'active') {
        const steps = document.querySelectorAll('.quark-gui-step');
        
        steps.forEach((step, index) => {
            const stepIndex = index + 1;
            
            if (stepIndex < stepNumber) {
                step.classList.remove('active', 'error');
                step.classList.add('completed');
            } else if (stepIndex === stepNumber) {
                step.classList.remove('completed', 'error', 'active');
                step.classList.add(status);
            } else {
                step.classList.remove('active', 'completed', 'error');
            }
        });

        this.currentStep = stepNumber;
    }

    /**
     * 显示结果
     * @param {boolean} success - 是否成功
     * @param {Object} result - 结果数据
     */
    showResult(success, result) {
        const resultSection = document.getElementById('resultSection');
        const resultContent = document.getElementById('resultContent');

        if (!resultSection || !resultContent) return;

        resultSection.style.display = 'block';

        if (success) {
            resultContent.innerHTML = `
                <div class="quark-gui-result-item">
                    <div class="quark-gui-result-icon">✅</div>
                    <div class="quark-gui-result-info">
                        <div class="quark-gui-result-title">转存成功</div>
                        <div class="quark-gui-result-detail">
                            <p><strong>文件名:</strong> ${result.data.fileName}</p>
                            <p><strong>文件类型:</strong> ${result.data.fileType}</p>
                            <p><strong>分享链接:</strong> <a href="${result.data.shareLink}" target="_blank">${result.data.shareLink}</a></p>
                        </div>
                    </div>
                    <div class="quark-gui-result-actions">
                        <button class="quark-gui-btn quark-gui-btn-small" onclick="navigator.clipboard.writeText('${result.data.shareLink}')">
                            复制链接
                        </button>
                        <button class="quark-gui-btn quark-gui-btn-small" onclick="window.open('${result.data.shareLink}', '_blank')">
                            打开链接
                        </button>
                    </div>
                </div>
            `;
        } else {
            // 检查是否为跳过状态
            if (result.skipped) {
                resultContent.innerHTML = `
                    <div class="quark-gui-result-item skipped">
                        <div class="quark-gui-result-icon">⏭️</div>
                        <div class="quark-gui-result-info">
                            <div class="quark-gui-result-title">重复文件，已跳过</div>
                            <div class="quark-gui-result-detail">
                                <p>${result.message}</p>
                                ${result.duplicateType ? `<p><strong>重复类型:</strong> ${result.duplicateType}重复</p>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            } else {
                resultContent.innerHTML = `
                    <div class="quark-gui-result-item error">
                        <div class="quark-gui-result-icon">❌</div>
                        <div class="quark-gui-result-info">
                            <div class="quark-gui-result-title">转存失败</div>
                            <div class="quark-gui-result-detail">
                                <p>${result.message}</p>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
    }

    /**
     * 显示批量转存结果
     * @param {number} successCount - 成功数量
     * @param {number} failCount - 失败数量
     * @param {number} skipCount - 跳过数量
     * @param {number} totalCount - 总数量
     */
    showBatchResult(successCount, failCount, skipCount, totalCount) {
        const resultSection = document.getElementById('resultSection');
        const resultContent = document.getElementById('resultContent');

        if (!resultSection || !resultContent) return;

        resultSection.style.display = 'block';

        const successItems = this.batchResults
            .filter(item => item.success)
            .map(item => `
                <div class="quark-gui-batch-result-item success">
                    <div class="quark-gui-result-icon">✅</div>
                    <div class="quark-gui-result-info">
                        <div class="quark-gui-result-title">${item.data.fileName}</div>
                        <div class="quark-gui-result-detail">
                            <p><strong>原链接:</strong> ${item.link}</p>
                            <p><strong>新链接:</strong> <a href="${item.data.shareLink}" target="_blank">${item.data.shareLink}</a></p>
                        </div>
                    </div>
                    <div class="quark-gui-result-actions">
                        <button class="quark-gui-btn quark-gui-btn-small" onclick="navigator.clipboard.writeText('${item.data.shareLink}')">
                            复制
                        </button>
                    </div>
                </div>
            `).join('');

        const skipItems = this.batchResults
            .filter(item => !item.success && item.skipped)
            .map(item => `
                <div class="quark-gui-batch-result-item skipped">
                    <div class="quark-gui-result-icon">⏭️</div>
                    <div class="quark-gui-result-info">
                        <div class="quark-gui-result-title">重复文件，已跳过</div>
                        <div class="quark-gui-result-detail">
                            <p><strong>文件名:</strong> ${item.fileName || '未知'}</p>
                            <p><strong>链接:</strong> ${item.link}</p>
                            <p><strong>重复类型:</strong> ${item.duplicateType}重复</p>
                        </div>
                    </div>
                </div>
            `).join('');

        const failItems = this.batchResults
            .filter(item => !item.success && !item.skipped)
            .map(item => `
                <div class="quark-gui-batch-result-item error">
                    <div class="quark-gui-result-icon">❌</div>
                    <div class="quark-gui-result-info">
                        <div class="quark-gui-result-title">转存失败</div>
                        <div class="quark-gui-result-detail">
                            <p><strong>链接:</strong> ${item.link}</p>
                            <p><strong>错误:</strong> ${item.message}</p>
                        </div>
                    </div>
                </div>
            `).join('');

        resultContent.innerHTML = `
            <div class="quark-gui-batch-summary">
                <h3>批量转存结果</h3>
                <div class="quark-gui-batch-stats">
                    <span class="success">成功: ${successCount}</span>
                    <span class="fail">失败: ${failCount}</span>
                    <span class="skip">跳过: ${skipCount}</span>
                    <span class="total">总计: ${totalCount}</span>
                </div>
            </div>
            <div class="quark-gui-batch-results">
                ${successItems}
                ${skipItems}
                ${failItems}
            </div>
        `;
    }

    /**
     * 更新转存按钮状态
     * @param {boolean} isTransferring - 是否正在转存
     */
    updateTransferButton(isTransferring) {
        const transferBtn = document.getElementById('transferBtn');
        if (transferBtn) {
            transferBtn.disabled = isTransferring;
            transferBtn.innerHTML = isTransferring ? 
                '<span class="quark-gui-loading"></span> 转存中...' : 
                '<span class="quark-gui-icon">🚀</span> 开始转存';
        }
    }

    /**
     * 重置转存状态
     */
    resetTransferState() {
        this.isTransferring = false;
        this.updateTransferButton(false);
        this.showProgress(false);
    }

    /**
     * 清空表单
     */
    clearForm() {
        const shareUrlInput = document.getElementById('shareUrl');
        const resultSection = document.getElementById('resultSection');

        if (shareUrlInput) {
            shareUrlInput.value = '';
            this.removeUrlValidation();
        }

        if (resultSection) {
            resultSection.style.display = 'none';
        }

        // 清空批量转存相关数据
        this.clearBatchInput();
        this.batchResults = [];
        this.isBatchMode = false;

        this.showProgress(false);
        this.updateTransferButtonForMode();
    }

    /**
     * 加载保存的数据
     */
    loadSavedData() {
        try {
            // 这里可以加载其他需要的数据，比如上次的输入内容等
            // 由于Cookie现在通过设置界面管理，这里暂时不需要加载任何数据
            this.logger.info('转存面板数据加载完成');
        } catch (error) {
            this.logger.error('加载保存数据失败:', error.message);
        }
    }

    /**
     * 绑定批量转存相关事件
     */
    bindBatchEvents() {
        // 批量输入框事件
        const batchInput = document.getElementById('batchInput');
        if (batchInput) {
            batchInput.addEventListener('input', (e) => {
                this.handleBatchInput(e.target.value);
            });

            batchInput.addEventListener('paste', (e) => {
                setTimeout(() => {
                    this.handleBatchInput(e.target.value);
                }, 10);
            });
        }

        // 清空批量输入按钮
        const clearBatchBtn = document.getElementById('clearBatchBtn');
        if (clearBatchBtn) {
            clearBatchBtn.addEventListener('click', () => {
                this.clearBatchInput();
            });
        }

        // 单链接输入框事件（用于互斥检查）
        const shareUrlInput = document.getElementById('shareUrl');
        if (shareUrlInput) {
            shareUrlInput.addEventListener('input', (e) => {
                this.handleSingleUrlInput(e.target.value);
            });
        }
    }

    /**
     * 处理批量输入
     * @param {string} text - 输入的文本
     */
    handleBatchInput(text) {
        // 检测链接
        this.detectedLinks = this.extractQuarkLinks(text);
        this.updateLinkCounter();
        this.updateLinkPreview();

        // 检查互斥逻辑
        this.checkInputConflict();
    }

    /**
     * 处理单链接输入
     * @param {string} url - 输入的URL
     */
    handleSingleUrlInput(url) {
        // 验证URL（保持原有逻辑）
        this.validateUrl(url);

        // 检查互斥逻辑
        this.checkInputConflict();
    }

    /**
     * 从文本中提取夸克网盘链接
     * @param {string} text - 输入文本
     * @returns {Array} 提取到的链接数组
     */
    extractQuarkLinks(text) {
        if (!text || !text.trim()) {
            return [];
        }

        // 夸克网盘链接正则表达式
        const quarkLinkRegex = /https:\/\/pan\.quark\.cn\/s\/[a-zA-Z0-9]+/g;
        const matches = text.match(quarkLinkRegex);

        if (!matches) {
            return [];
        }

        // 去重并返回
        return [...new Set(matches)];
    }

    /**
     * 更新链接计数器
     */
    updateLinkCounter() {
        const linkCounter = document.getElementById('linkCounter');
        if (linkCounter) {
            const count = this.detectedLinks.length;
            linkCounter.textContent = `识别到 ${count} 个链接`;
            linkCounter.style.color = count > 0 ? 'var(--quark-primary-color)' : 'var(--quark-text-secondary)';
        }
    }

    /**
     * 更新链接预览
     */
    updateLinkPreview() {
        const linkPreview = document.getElementById('linkPreview');
        const linkList = document.getElementById('linkList');

        if (!linkPreview || !linkList) return;

        if (this.detectedLinks.length > 0) {
            linkPreview.style.display = 'block';
            linkList.innerHTML = this.detectedLinks
                .map(link => `<li>${link}</li>`)
                .join('');
        } else {
            linkPreview.style.display = 'none';
            linkList.innerHTML = '';
        }
    }

    /**
     * 检查输入冲突（互斥逻辑）
     */
    checkInputConflict() {
        const shareUrl = document.getElementById('shareUrl')?.value.trim();
        const batchText = document.getElementById('batchInput')?.value.trim();

        const hasSingleUrl = shareUrl && isValidQuarkUrl(shareUrl);
        const hasBatchLinks = this.detectedLinks.length > 0;

        if (hasSingleUrl && hasBatchLinks) {
            this.showInputConflictDialog();
        } else {
            this.isBatchMode = hasBatchLinks && !hasSingleUrl;
            this.updateTransferButtonForMode();
        }
    }

    /**
     * 显示输入冲突对话框
     */
    showInputConflictDialog() {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        const modalConfirm = document.getElementById('modalConfirm');
        const modalCancel = document.getElementById('modalCancel');

        if (modalTitle) modalTitle.textContent = '选择转存模式';
        if (modalBody) {
            modalBody.innerHTML = `
                <p>检测到您同时输入了单个链接和批量文本。</p>
                <p>请选择要使用的转存模式：</p>
                <div style="margin: 15px 0;">
                    <p><strong>单链接转存：</strong>只转存分享链接输入框中的链接</p>
                    <p><strong>批量转存：</strong>转存批量文本中识别到的 ${this.detectedLinks.length} 个链接</p>
                </div>
            `;
        }

        if (modalConfirm) {
            modalConfirm.textContent = '使用批量转存';
            modalConfirm.onclick = () => {
                modal.style.display = 'none';
                this.chooseBatchMode();
            };
        }

        if (modalCancel) {
            modalCancel.textContent = '使用单链接转存';
            modalCancel.onclick = () => {
                modal.style.display = 'none';
                this.chooseSingleMode();
            };
        }

        if (modal) {
            modal.style.display = 'flex';
        }
    }

    /**
     * 选择批量转存模式
     */
    chooseBatchMode() {
        // 清空单链接输入
        const shareUrlInput = document.getElementById('shareUrl');
        if (shareUrlInput) {
            shareUrlInput.value = '';
            this.removeUrlValidation();
        }

        this.isBatchMode = true;
        this.updateTransferButtonForMode();
    }

    /**
     * 选择单链接转存模式
     */
    chooseSingleMode() {
        // 清空批量输入
        this.clearBatchInput();

        this.isBatchMode = false;
        this.updateTransferButtonForMode();
    }

    /**
     * 根据模式更新转存按钮
     */
    updateTransferButtonForMode() {
        const transferBtn = document.getElementById('transferBtn');
        if (!transferBtn) return;

        if (this.isBatchMode) {
            transferBtn.innerHTML = '<span class="quark-gui-icon">📦</span> 批量转存';
            transferBtn.disabled = this.detectedLinks.length === 0;
        } else {
            transferBtn.innerHTML = '<span class="quark-gui-icon">🚀</span> 开始转存';
            const shareUrl = document.getElementById('shareUrl')?.value.trim();
            transferBtn.disabled = !shareUrl || !isValidQuarkUrl(shareUrl);
        }
    }

    /**
     * 清空批量输入
     */
    clearBatchInput() {
        const batchInput = document.getElementById('batchInput');
        if (batchInput) {
            batchInput.value = '';
        }

        this.detectedLinks = [];
        this.updateLinkCounter();
        this.updateLinkPreview();
        this.isBatchMode = false;
        this.updateTransferButtonForMode();
    }

    /**
     * 面板激活回调
     */
    onActivated() {
        // 面板激活时的处理逻辑
        this.logger.info('转存面板已激活');
    }
}

export default TransferPanel;
