export class IndexedDBService {
    constructor(dbName = 'QuarkGUI', version = 2) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
        this.storeName = 'files';
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(new Error('数据库打开失败'));
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const { oldVersion } = event;

                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, {
                        keyPath: 'id',
                        autoIncrement: true
                    });

                    store.createIndex('fileName', 'fileName', { unique: false });
                    store.createIndex('fileType', 'fileType', { unique: false });
                    store.createIndex('createTime', 'createTime', { unique: false });
                }

                if (oldVersion < 2) {
                    const transaction = event.target.transaction;
                    const store = transaction.objectStore(this.storeName);

                    ['shareLink', 'shareUrl', 'originalUrl'].forEach(indexName => {
                        if (!store.indexNames.contains(indexName)) {
                            store.createIndex(indexName, indexName, { unique: false });
                        }
                    });
                }
            };
        });
    }

    async fileExists(fileName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('fileName');
            const request = index.get(fileName);

            request.onsuccess = () => resolve(!!request.result);
            request.onerror = () => reject(new Error('检查文件存在性失败'));
        });
    }

    async fileExistsByShareLink(shareLink) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);

                const checkWithIndex = async (indexName) => {
                    if (store.indexNames.contains(indexName)) {
                        const index = store.index(indexName);
                        const request = index.get(shareLink);
                        return new Promise((res) => {
                            request.onsuccess = () => res(!!request.result);
                            request.onerror = () => res(false);
                        });
                    }
                    return false;
                };

                Promise.all([
                    checkWithIndex('shareLink'),
                    checkWithIndex('shareUrl'),
                    checkWithIndex('originalUrl')
                ]).then(results => {
                    const foundInIndex = results.some(result => result);

                    if (foundInIndex) {
                        resolve(true);
                        return;
                    }

                    const getAllRequest = store.getAll();
                    getAllRequest.onsuccess = () => {
                        const files = getAllRequest.result;
                        const exists = files.some(file =>
                            file.shareLink === shareLink ||
                            file.shareUrl === shareLink ||
                            file.originalUrl === shareLink
                        );
                        resolve(exists);
                    };
                    getAllRequest.onerror = () => resolve(false);
                }).catch(() => resolve(false));

            } catch (error) {
                resolve(false);
            }
        });
    }

    async checkDuplicate(fileName, shareLink) {
        try {
            const [nameExists, linkExists] = await Promise.all([
                this.fileExists(fileName),
                this.fileExistsByShareLink(shareLink)
            ]);

            return {
                exists: nameExists || linkExists,
                duplicateType: nameExists ? (linkExists ? 'both' : 'name') : (linkExists ? 'link' : 'none'),
                nameExists,
                linkExists
            };
        } catch (error) {
            throw new Error(`检查重复文件失败: ${error.message}`);
        }
    }

    async addFile(fileData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const record = {
                fileId: fileData.fileId || '',
                fileName: fileData.fileName || '',
                fileType: fileData.fileType || 'unknown',
                shareLink: fileData.shareUrl || fileData.shareLink || '',
                shareUrl: fileData.shareUrl || fileData.shareLink || '',
                originalUrl: fileData.originalUrl || '',
                transferTime: fileData.transferTime || new Date().toISOString(),
                source: fileData.source || 'unknown',
                status: fileData.status || 'completed',
                createTime: new Date().toISOString(),
                updateTime: new Date().toISOString()
            };

            const request = store.add(record);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error('添加文件记录失败'));
        });
    }

    async insertFile(fileId, fileName, fileType, shareLink) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const fileData = {
                fileId,
                fileName,
                fileType,
                shareLink,
                createTime: new Date().toISOString(),
                updateTime: new Date().toISOString()
            };

            const request = store.add(fileData);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error('插入文件记录失败'));
        });
    }

    async updateFile(id, updateData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const data = getRequest.result;
                if (data) {
                    Object.assign(data, updateData, {
                        updateTime: new Date().toISOString()
                    });

                    const putRequest = store.put(data);
                    putRequest.onsuccess = () => resolve();
                    putRequest.onerror = () => reject(new Error('更新文件记录失败'));
                } else {
                    reject(new Error('记录不存在'));
                }
            };

            getRequest.onerror = () => reject(new Error('获取文件记录失败'));
        });
    }

    async deleteFile(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error('删除文件记录失败'));
        });
    }

    async deleteFileByName(fileName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('fileName');
            const request = index.openCursor(fileName);

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };

            request.onerror = () => reject(new Error('删除文件记录失败'));
        });
    }

    async getAllFiles(options = {}) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                let files = request.result;

                if (options.sortBy) {
                    files.sort((a, b) => {
                        const aVal = a[options.sortBy];
                        const bVal = b[options.sortBy];

                        if (options.sortOrder === 'desc') {
                            return bVal > aVal ? 1 : -1;
                        } else {
                            return aVal > bVal ? 1 : -1;
                        }
                    });
                }

                if (options.page && options.pageSize) {
                    const start = (options.page - 1) * options.pageSize;
                    const end = start + options.pageSize;
                    files = files.slice(start, end);
                }

                resolve(files);
            };

            request.onerror = () => reject(new Error('获取文件列表失败'));
        });
    }

    async searchFiles(keyword, options = {}) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                let files = request.result;

                if (keyword) {
                    const lowerKeyword = keyword.toLowerCase();
                    files = files.filter(file =>
                        (file.fileName || '').toString().toLowerCase().includes(lowerKeyword) ||
                        (file.fileType || '').toString().toLowerCase().includes(lowerKeyword)
                    );
                }

                if (options.fileType) {
                    files = files.filter(file => file.fileType === options.fileType);
                }

                if (options.startDate || options.endDate) {
                    files = files.filter(file => {
                        const createTime = new Date(file.createTime);
                        if (options.startDate && createTime < new Date(options.startDate)) {
                            return false;
                        }
                        if (options.endDate && createTime > new Date(options.endDate)) {
                            return false;
                        }
                        return true;
                    });
                }

                resolve(files);
            };

            request.onerror = () => reject(new Error('搜索文件失败'));
        });
    }

    async getFileCount() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error('获取文件数量失败'));
        });
    }

    async clearAllData() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error('清空数据失败'));
        });
    }

    async exportData() {
        const files = await this.getAllFiles();
        return {
            version: this.version,
            exportTime: new Date().toISOString(),
            data: files
        };
    }

    async importData(importData) {
        if (!importData.data || !Array.isArray(importData.data)) {
            throw new Error('导入数据格式错误');
        }

        let importCount = 0;

        for (const fileData of importData.data) {
            try {
                const exists = await this.fileExists(fileData.fileName);
                if (!exists) {
                    await this.insertFile(
                        fileData.fileId,
                        fileData.fileName,
                        fileData.fileType,
                        fileData.shareLink
                    );
                    importCount++;
                }
            } catch (error) {
                // 忽略导入失败的文件
            }
        }

        return importCount;
    }

    async getStatistics() {
        const files = await this.getAllFiles();
        const stats = {
            totalFiles: files.length,
            fileTypes: {},
            createDates: {},
            totalSize: 0
        };

        files.forEach(file => {
            stats.fileTypes[file.fileType] = (stats.fileTypes[file.fileType] || 0) + 1;
            const date = new Date(file.createTime).toDateString();
            stats.createDates[date] = (stats.createDates[date] || 0) + 1;
        });

        return stats;
    }

    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}

export default IndexedDBService;
