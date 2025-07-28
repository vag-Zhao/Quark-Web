import { generateTimestamp, generateRandomDelay } from '../utils/timeUtils.js';
import { getIdFromUrl } from '../utils/urlUtils.js';

class QuarkWebService {
    constructor(cookie, logger, options = {}) {
        this.cookie = cookie;
        this.logger = logger;
        this.useProxy = options.useProxy || this.detectProxyMode();
        this.proxyUrl = options.proxyUrl || this.getDefaultProxyUrl();
        this.baseUrl = this.useProxy ? this.proxyUrl : 'https://drive-pc.quark.cn';
        this.requestTimeout = 30000;

        this.headers = {
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

        if (this.useProxy) {
            this.headers['X-Quark-Cookie'] = cookie;
        } else {
            this.headers['cookie'] = cookie;
        }

        this.logger.info(`QuarkWebService初始化 - 代理模式: ${this.useProxy ? '启用' : '禁用'}`);
    }

    getDefaultProxyUrl() {
        const customProxyUrl = localStorage.getItem('quark-gui-proxy-url');
        if (customProxyUrl) return customProxyUrl;

        const { hostname, protocol } = window.location;

        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:8081';
        }

        return protocol === 'https:' ? `http://${hostname}:8081` : `http://${hostname}:8081`;
    }

    detectProxyMode() {
        const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname) ||
                           window.location.protocol === 'file:';
        const proxyEnabled = localStorage.getItem('quark-gui-proxy-enabled') === 'true';

        return isLocalhost || proxyEnabled || !isLocalhost;
    }

    buildUrl(path) {
        return this.useProxy ? `${this.proxyUrl}${path}` : `${this.baseUrl}${path}`;
    }

    async request(path, options = {}, retries = 3) {
        let lastError;

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const url = this.buildUrl(path);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

                const response = await fetch(url, {
                    ...options,
                    headers: { ...this.headers, ...options.headers },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text().catch(() => response.statusText);
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }

                return await response.json();

            } catch (error) {
                lastError = error;

                if (error.name === 'AbortError') {
                    this.logger.warn(`请求超时 (${attempt}/${retries}): ${path}`);
                } else if (error.message.includes('ECONNRESET') || error.message.includes('network')) {
                    this.logger.warn(`网络错误 (${attempt}/${retries}): ${path}`);
                } else {
                    this.logger.error(`请求失败 (${attempt}/${retries}): ${path}`, error);
                }

                if (attempt < retries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        this.logger.error(`请求最终失败: ${path}`, lastError);
        throw lastError;
    }

    async testConnection() {
        try {
            const timestamp = generateTimestamp(13);
            const path = `/1/clouddrive/file/sort?pr=ucpro&fr=pc&uc_param_str=&pdir_fid=0&_page=1&_size=1&_fetch_total=1&_fetch_sub_dirs=0&_sort=file_type:asc,updated_at:desc&__dt=405&__t=${timestamp}`;
            const response = await this.request(path);

            if (response && (response.status === 200 || response.code === 0)) {
                return { success: true, message: 'Cookie有效' };
            }
            return { success: false, message: 'Cookie无效或已过期' };
        } catch (error) {
            this.logger.error('Cookie连接测试失败:', error.message);
            return { success: false, message: `连接测试失败: ${error.message}` };
        }
    }

    async store(url, progressCallback) {
        try {
            this.logger.info(`开始转存文件: ${url}`);

            progressCallback?.(1, '解析链接', 10);
            const pwdId = getIdFromUrl(url);
            if (!pwdId) throw new Error('无法从链接中提取文件ID');

            progressCallback?.(2, '获取分享令牌', 20);
            const stoken = await this.getStoken(pwdId);
            if (!stoken) throw new Error('获取分享令牌失败');

            progressCallback?.(3, '获取文件详情', 40);
            const detail = await this.detail(pwdId, stoken);
            if (!detail) throw new Error('获取文件详情失败');

            const fileName = detail.title;

            progressCallback?.(4, '执行转存任务', 60);
            const saveTaskId = await this.saveTaskId(pwdId, stoken, detail.fid, detail.share_fid_token);
            if (!saveTaskId) throw new Error('获取保存任务ID失败');

            const taskResponse = await this.task(saveTaskId);
            if (!taskResponse?.data?.save_as?.save_as_top_fids?.length) {
                throw new Error('执行保存任务失败');
            }

            const fileId = taskResponse.data.save_as.save_as_top_fids[0];

            progressCallback?.(5, '生成分享链接', 80);
            const shareTaskId = await this.shareTaskId(fileId, fileName);
            if (!shareTaskId) throw new Error('创建分享任务失败');

            const shareTaskResponse = await this.task(shareTaskId);
            if (!shareTaskResponse?.data?.share_id) {
                throw new Error('执行分享任务失败');
            }

            const shareId = shareTaskResponse.data.share_id;
            const shareLink = await this.getShareLink(shareId);
            if (!shareLink) throw new Error('获取分享链接失败');

            progressCallback?.(5, '转存完成', 100);

            this.logger.info(`文件转存成功: ${fileName}`);
            return {
                success: true,
                message: `文件转存成功: ${fileName}`,
                data: {
                    fileId,
                    fileName,
                    fileType: detail.file_type,
                    shareLink
                }
            };

        } catch (error) {
            this.logger.error('转存失败:', error.message);
            progressCallback?.(-1, `转存失败: ${error.message}`, 0);
            return { success: false, message: `转存失败: ${error.message}` };
        }
    }

    async getStoken(pwdId) {
        try {
            const timestamp = generateTimestamp(13);
            const path = `/1/clouddrive/share/sharepage/token?pr=ucpro&fr=pc&uc_param_str=&__dt=405&__t=${timestamp}`;

            const response = await this.request(path, {
                method: 'POST',
                body: JSON.stringify({ pwd_id: pwdId, passcode: "" })
            });

            return response?.data?.stoken || '';
        } catch (error) {
            this.logger.error('获取stoken失败:', error.message);
            return '';
        }
    }

    async detail(pwdId, stoken) {
        try {
            const timestamp = generateTimestamp(13);
            const params = new URLSearchParams({
                pwd_id: pwdId,
                stoken: stoken,
                pdir_fid: '0',
                _page: '1',
                _size: '50',
                force: '0',
                __dt: '21192',
                __t: timestamp
            });

            const path = `/1/clouddrive/share/sharepage/detail?${params}`;
            const response = await this.request(path);

            if (response?.data?.list?.length > 0) {
                const idList = response.data.list[0];
                return {
                    title: idList.file_name,
                    file_type: idList.file_type,
                    fid: idList.fid,
                    pdir_fid: idList.pdir_fid,
                    share_fid_token: idList.share_fid_token
                };
            }

            return null;
        } catch (error) {
            this.logger.error('获取文件详情失败:', error.message);
            return null;
        }
    }

    async saveTaskId(pwdId, stoken, firstId, shareFidToken, toPdirFid = "0") {
        try {
            const params = new URLSearchParams({
                pr: "ucpro",
                fr: "pc",
                uc_param_str: "",
                __dt: generateRandomDelay(1, 5),
                __t: generateTimestamp(13)
            });

            const path = `/1/clouddrive/share/sharepage/save?${params}`;
            const response = await this.request(path, {
                method: 'POST',
                body: JSON.stringify({
                    fid_list: [firstId],
                    fid_token_list: [shareFidToken],
                    to_pdir_fid: toPdirFid,
                    pwd_id: pwdId,
                    stoken: stoken,
                    pdir_fid: "0",
                    scene: "link"
                })
            });

            return response?.data?.task_id || '';
        } catch (error) {
            this.logger.error('获取保存任务ID失败:', error.message);
            return '';
        }
    }

    async task(taskId, maxTries = 10) {
        try {
            for (let i = 0; i < maxTries; i++) {
                const timestamp = generateTimestamp(13);
                const path = `/1/clouddrive/task?pr=ucpro&fr=pc&uc_param_str=&task_id=${taskId}&retry_index=${i}&__dt=21192&__t=${timestamp}`;

                const response = await this.request(path);

                if (response?.data?.status) {
                    return response;
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            return null;
        } catch (error) {
            this.logger.error('执行任务失败:', error.message);
            return null;
        }
    }

    async shareTaskId(fileId, fileName) {
        try {
            const path = "/1/clouddrive/share?pr=ucpro&fr=pc&uc_param_str=";

            const response = await this.request(path, {
                method: 'POST',
                body: JSON.stringify({
                    fid_list: [fileId],
                    title: fileName,
                    url_type: 1,
                    expired_type: 1
                })
            });

            return response?.data?.task_id || '';
        } catch (error) {
            this.logger.error('创建分享任务失败:', error.message);
            return '';
        }
    }

    async getShareLink(shareId) {
        try {
            const path = "/1/clouddrive/share/password?pr=ucpro&fr=pc&uc_param_str=";

            const response = await this.request(path, {
                method: 'POST',
                body: JSON.stringify({ share_id: shareId })
            });

            return response?.data?.share_url || '';
        } catch (error) {
            this.logger.error('获取分享链接失败:', error.message);
            return '';
        }
    }

    async searchFile(fileName) {
        try {
            const path = "/1/clouddrive/file/search?pr=ucpro&fr=pc&uc_param_str=&_page=1&_size=50&_fetch_total=1&_sort=file_type:desc,updated_at:desc&_is_hl=1";
            const params = new URLSearchParams({ q: fileName });
            const response = await this.request(`${path}&${params}`);

            return response?.data?.list || [];
        } catch (error) {
            this.logger.error('搜索文件失败:', error.message);
            return [];
        }
    }

    async getFileInfo(url) {
        try {
            const pwdId = getIdFromUrl(url);
            if (!pwdId) throw new Error('无法从链接中提取文件ID');

            const stoken = await this.getStoken(pwdId);
            if (!stoken) throw new Error('获取分享令牌失败');

            const detail = await this.detail(pwdId, stoken);
            if (!detail) throw new Error('获取文件详情失败');

            return {
                fileName: detail.title,
                fileType: detail.file_type,
                fileSize: detail.size || 0,
                fid: detail.fid,
                shareFidToken: detail.share_fid_token
            };

        } catch (error) {
            this.logger.error('获取文件信息失败:', error.message);
            return null;
        }
    }

    async checkDuplicateInCloud(fileName) {
        try {
            const searchResults = await this.searchFile(fileName);
            const exactMatch = searchResults.find(file => file.file_name === fileName);

            if (exactMatch) {
                return {
                    exists: true,
                    fileInfo: {
                        name: exactMatch.file_name,
                        size: exactMatch.size,
                        type: exactMatch.file_type,
                        createTime: exactMatch.created_at,
                        updateTime: exactMatch.updated_at
                    }
                };
            }

            return { exists: false };
        } catch (error) {
            this.logger.error('检查网盘重复文件失败:', error.message);
            return { exists: false };
        }
    }
}

export default QuarkWebService;
