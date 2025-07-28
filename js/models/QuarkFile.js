/**
 * 夸克文件模型
 * 定义文件数据结构
 */

export class QuarkFile {
    /**
     * 构造函数
     * @param {Object} data - 文件数据
     */
    constructor(data = {}) {
        this.id = data.id || null;
        this.fileId = data.fileId || '';
        this.fileName = data.fileName || '';
        this.fileType = data.fileType || '';
        this.shareLink = data.shareLink || '';
        this.createTime = data.createTime || new Date().toISOString();
        this.updateTime = data.updateTime || new Date().toISOString();
        this.fileSize = data.fileSize || 0;
        this.downloadCount = data.downloadCount || 0;
        this.tags = data.tags || [];
        this.description = data.description || '';
        this.isPublic = data.isPublic !== undefined ? data.isPublic : true;
        this.expiryDate = data.expiryDate || null;
    }

    /**
     * 从数据库行创建QuarkFile实例
     * @param {Object} row - 数据库行数据
     * @returns {QuarkFile} QuarkFile实例
     */
    static fromDatabaseRow(row) {
        return new QuarkFile({
            id: row.id,
            fileId: row.fileId || row.FILE_ID,
            fileName: row.fileName || row.FILE_NAME,
            fileType: row.fileType || row.FILE_TYPE,
            shareLink: row.shareLink || row.SHARE_LINK,
            createTime: row.createTime || row.CREATE_TIME,
            updateTime: row.updateTime || row.UPDATE_TIME,
            fileSize: row.fileSize || row.FILE_SIZE || 0,
            downloadCount: row.downloadCount || row.DOWNLOAD_COUNT || 0,
            tags: row.tags ? (typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags) : [],
            description: row.description || row.DESCRIPTION || '',
            isPublic: row.isPublic !== undefined ? row.isPublic : (row.IS_PUBLIC !== undefined ? row.IS_PUBLIC : true),
            expiryDate: row.expiryDate || row.EXPIRY_DATE
        });
    }

    /**
     * 从API响应创建QuarkFile实例
     * @param {Object} apiData - API响应数据
     * @returns {QuarkFile} QuarkFile实例
     */
    static fromApiResponse(apiData) {
        return new QuarkFile({
            fileId: apiData.file_id || apiData.fid,
            fileName: apiData.file_name || apiData.title,
            fileType: apiData.file_type || apiData.type,
            shareLink: apiData.share_link || apiData.share_url,
            fileSize: apiData.file_size || apiData.size || 0,
            createTime: apiData.create_time || apiData.created_at,
            updateTime: apiData.update_time || apiData.updated_at
        });
    }

    /**
     * 转换为数据库插入格式
     * @returns {Object} 数据库插入对象
     */
    toDatabaseObject() {
        return {
            fileId: this.fileId,
            fileName: this.fileName,
            fileType: this.fileType,
            shareLink: this.shareLink,
            createTime: this.createTime,
            updateTime: this.updateTime,
            fileSize: this.fileSize,
            downloadCount: this.downloadCount,
            tags: JSON.stringify(this.tags),
            description: this.description,
            isPublic: this.isPublic,
            expiryDate: this.expiryDate
        };
    }

    /**
     * 转换为JSON对象
     * @returns {Object} JSON对象
     */
    toJSON() {
        return {
            id: this.id,
            fileId: this.fileId,
            fileName: this.fileName,
            fileType: this.fileType,
            shareLink: this.shareLink,
            createTime: this.createTime,
            updateTime: this.updateTime,
            fileSize: this.fileSize,
            downloadCount: this.downloadCount,
            tags: this.tags,
            description: this.description,
            isPublic: this.isPublic,
            expiryDate: this.expiryDate
        };
    }

    /**
     * 验证文件数据是否完整
     * @returns {Object} 验证结果
     */
    validate() {
        const errors = [];
        const warnings = [];

        // 必填字段验证
        if (!this.fileName) {
            errors.push('文件名不能为空');
        }

        if (!this.fileType) {
            warnings.push('文件类型未指定');
        }

        if (!this.shareLink) {
            errors.push('分享链接不能为空');
        }

        // 格式验证
        if (this.shareLink && !this.isValidShareLink(this.shareLink)) {
            errors.push('分享链接格式无效');
        }

        if (this.fileSize < 0) {
            warnings.push('文件大小不能为负数');
        }

        if (this.downloadCount < 0) {
            warnings.push('下载次数不能为负数');
        }

        // 日期验证
        if (this.expiryDate && new Date(this.expiryDate) < new Date()) {
            warnings.push('文件已过期');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * 验证分享链接格式
     * @param {string} link - 分享链接
     * @returns {boolean} 是否有效
     */
    isValidShareLink(link) {
        try {
            const url = new URL(link);
            return url.hostname === 'pan.quark.cn' && url.pathname.includes('/s/');
        } catch (error) {
            return false;
        }
    }

    /**
     * 获取文件扩展名
     * @returns {string} 文件扩展名
     */
    getFileExtension() {
        const lastDotIndex = this.fileName.lastIndexOf('.');
        if (lastDotIndex > 0 && lastDotIndex < this.fileName.length - 1) {
            return this.fileName.substring(lastDotIndex + 1).toLowerCase();
        }
        return '';
    }

    /**
     * 获取文件大小的可读格式
     * @returns {string} 格式化的文件大小
     */
    getFormattedFileSize() {
        if (this.fileSize === 0) return '未知';
        
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = this.fileSize;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    /**
     * 检查文件是否已过期
     * @returns {boolean} 是否已过期
     */
    isExpired() {
        if (!this.expiryDate) return false;
        return new Date(this.expiryDate) < new Date();
    }

    /**
     * 获取文件类型图标
     * @returns {string} 图标字符
     */
    getTypeIcon() {
        const type = (this.fileType || '').toString().toLowerCase();
        const extension = this.getFileExtension();
        
        // 视频文件
        if (type.includes('video') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(extension)) {
            return '🎬';
        }
        
        // 音频文件
        if (type.includes('audio') || ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'].includes(extension)) {
            return '🎵';
        }
        
        // 图片文件
        if (type.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(extension)) {
            return '🖼️';
        }
        
        // 文档文件
        if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(extension)) {
            return '📄';
        }
        
        // 表格文件
        if (['xls', 'xlsx', 'csv'].includes(extension)) {
            return '📊';
        }
        
        // 演示文件
        if (['ppt', 'pptx'].includes(extension)) {
            return '📽️';
        }
        
        // 压缩文件
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
            return '📦';
        }
        
        // 代码文件
        if (['js', 'html', 'css', 'py', 'java', 'cpp', 'c', 'php'].includes(extension)) {
            return '💻';
        }
        
        // 默认文件
        return '📁';
    }

    /**
     * 添加标签
     * @param {string} tag - 标签
     */
    addTag(tag) {
        if (tag && !this.tags.includes(tag)) {
            this.tags.push(tag);
            this.updateTime = new Date().toISOString();
        }
    }

    /**
     * 移除标签
     * @param {string} tag - 标签
     */
    removeTag(tag) {
        const index = this.tags.indexOf(tag);
        if (index > -1) {
            this.tags.splice(index, 1);
            this.updateTime = new Date().toISOString();
        }
    }

    /**
     * 检查是否包含标签
     * @param {string} tag - 标签
     * @returns {boolean} 是否包含
     */
    hasTag(tag) {
        return this.tags.includes(tag);
    }

    /**
     * 增加下载次数
     */
    incrementDownloadCount() {
        this.downloadCount++;
        this.updateTime = new Date().toISOString();
    }

    /**
     * 更新文件信息
     * @param {Object} updates - 更新数据
     */
    update(updates) {
        Object.keys(updates).forEach(key => {
            if (this.hasOwnProperty(key) && updates[key] !== undefined) {
                this[key] = updates[key];
            }
        });
        this.updateTime = new Date().toISOString();
    }

    /**
     * 克隆文件对象
     * @returns {QuarkFile} 克隆的文件对象
     */
    clone() {
        return new QuarkFile(this.toJSON());
    }

    /**
     * 比较两个文件是否相同
     * @param {QuarkFile} other - 另一个文件对象
     * @returns {boolean} 是否相同
     */
    equals(other) {
        if (!(other instanceof QuarkFile)) return false;
        
        return this.fileId === other.fileId &&
               this.fileName === other.fileName &&
               this.shareLink === other.shareLink;
    }

    /**
     * 获取文件的唯一标识
     * @returns {string} 唯一标识
     */
    getUniqueId() {
        return `${this.fileId}_${this.fileName}`;
    }

    /**
     * 转换为字符串表示
     * @returns {string} 字符串表示
     */
    toString() {
        return `QuarkFile(${this.fileName}, ${this.fileType}, ${this.getFormattedFileSize()})`;
    }
}

export default QuarkFile;
