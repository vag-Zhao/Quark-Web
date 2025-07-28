/**
 * 简单的CORS代理服务器
 * 用于解决Web版本的跨域问题
 */

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8081;
const HOST = process.env.HOST || '0.0.0.0'; // 监听所有网络接口
const USE_HTTPS = process.env.USE_HTTPS === 'true' || false;
const TARGET_HOST = 'drive-pc.quark.cn';
const SEARCH_API = 'https://hunhepan.com/open/search/disk';

// 允许的域名列表
const ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:5501',
    '自己的域名'
    // 可以根据需要添加更多域名
];

// 创建自签名证书选项（仅用于开发环境）
function createSelfSignedCertOptions() {
    // 使用Node.js内置的自签名证书生成
    try {
        const { generateKeyPairSync } = require('crypto');
        const { publicKey, privateKey } = generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });

        // 简单的自签名证书（仅用于开发）
        const cert = `-----BEGIN CERTIFICATE-----
MIICljCCAX4CCQDAOxKQlRcqxTANBgkqhkiG9w0BAQsFADANMQswCQYDVQQGEwJV
UzAeFw0yNTA3MjUwMDAwMDBaFw0yNjA3MjUwMDAwMDBaMA0xCzAJBgNVBAYTAlVT
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuGbXWiK5BVWbGSAHvx+k
8kMjXs28sbExnVQKJY+9IJCh/LMDiRd+Ms4PiIvac4SnAwfV49cc4VQVcjPZ4rBZ
-----END CERTIFICATE-----`;

        return { key: privateKey, cert };
    } catch (error) {
        console.warn('无法生成证书，使用预设证书');
        // 回退到预设证书
        const cert = `-----BEGIN CERTIFICATE-----
MIICljCCAX4CCQDAOxKQlRcqxTANBgkqhkiG9w0BAQsFADANMQswCQYDVQQGEwJV
UzAeFw0yNTA3MjUwMDAwMDBaFw0yNjA3MjUwMDAwMDBaMA0xCzAJBgNVBAYTAlVT
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuGbXWiK5BVWbGSAHvx+k
8kMjXs28sbExnVQKJY+9IJCh/LMDiRd+Ms4PiIvac4SnAwfV49cc4VQVcjPZ4rBZ
-----END CERTIFICATE-----`;

        const key = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC4ZtdaIrkFVZsZ
IAe/H6TyQyNezbyxsTGdVAolj70gkKH8swOJF34yzg+Ii9pzhKcDB9Xj1xzhVBVy
M9nisFlAgEAAoIBAQC4ZtdaIrkFVZsZIAe/H6TyQyNezbyxsTGdVAolj70gkKH8
-----END PRIVATE KEY-----`;

        return { key, cert };
    }
}

// 创建代理服务器
function createRequestHandler(req, res) {
    // 获取请求的origin
    const origin = req.headers.origin;

    // 检查origin是否在允许列表中
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, X-Requested-With, X-Quark-Cookie');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // 处理预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // 解析请求URL
    const parsedUrl = url.parse(req.url);

    // 处理健康检查端点
    if (parsedUrl.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
        return;
    }

    // 处理搜索API请求
    if (parsedUrl.pathname === '/api/search') {
        handleSearchRequest(req, res);
        return;
    }
    
    // 构建目标URL
    const targetUrl = `https://${TARGET_HOST}${parsedUrl.path}`;
    
    console.log(`代理请求: ${req.method} ${targetUrl}`);
    console.log(`请求头:`, JSON.stringify(req.headers, null, 2));

    // 准备请求选项
    const options = {
        hostname: TARGET_HOST,
        port: 443,
        path: parsedUrl.path,
        method: req.method,
        headers: {
            ...req.headers,
            host: TARGET_HOST,
            origin: 'https://pan.quark.cn',
            referer: 'https://pan.quark.cn/'
        }
    };

    // 处理自定义Cookie头
    if (req.headers['x-quark-cookie']) {
        options.headers['cookie'] = req.headers['x-quark-cookie'];
        console.log(`设置Cookie: ${req.headers['x-quark-cookie']}`);
    }

    // 删除可能导致问题的头
    delete options.headers['access-control-request-method'];
    delete options.headers['access-control-request-headers'];
    delete options.headers['x-quark-cookie'];
    delete options.headers['connection'];
    delete options.headers['upgrade-insecure-requests'];

    // 确保Cookie头部存在且格式正确
    if (options.headers.cookie) {
        console.log(`Cookie: ${options.headers.cookie.substring(0, 100)}...`);
    } else {
        console.log('警告: 没有找到Cookie头部');
    }

    console.log(`转发头:`, JSON.stringify(options.headers, null, 2));

    // 创建代理请求
    const proxyReq = https.request(options, (proxyRes) => {
        console.log(`响应状态: ${proxyRes.statusCode}`);
        console.log(`响应头:`, JSON.stringify(proxyRes.headers, null, 2));

        // 复制响应头，但保留CORS头
        const responseHeaders = { ...proxyRes.headers };
        responseHeaders['Access-Control-Allow-Origin'] = origin;
        responseHeaders['Access-Control-Allow-Credentials'] = 'true';

        // 设置响应头
        res.writeHead(proxyRes.statusCode, responseHeaders);

        // 转发响应数据
        proxyRes.pipe(res);
    });

    // 错误处理
    proxyReq.on('error', (err) => {
        console.error('代理请求错误:', err);
        res.writeHead(500);
        res.end('代理服务器错误');
    });

    // 转发请求数据
    req.pipe(proxyReq);
}

// 创建服务器实例
const server = USE_HTTPS ?
    https.createServer(createSelfSignedCertOptions(), createRequestHandler) :
    http.createServer(createRequestHandler);

// 启动服务器
server.listen(PORT, HOST, () => {
    const protocol = USE_HTTPS ? 'https' : 'http';
    console.log(`CORS代理服务器已启动: ${protocol}://${HOST}:${PORT}`);
    console.log(`夸克网盘API: https://${TARGET_HOST}`);
    console.log(`搜索API: ${SEARCH_API}`);
    console.log(`HTTPS模式: ${USE_HTTPS ? '启用' : '禁用'}`);
    console.log('');
    console.log('允许的域名:');
    ALLOWED_ORIGINS.forEach((origin, index) => {
        console.log(`${index + 1}. ${origin}`);
    });
    console.log('');
    console.log('支持的API路由:');
    console.log('1. /api/search → 转发到搜索API');
    console.log('2. 其他路径 → 转发到夸克网盘API');
    console.log('3. /health → 健康检查');
    console.log('');
    console.log('使用方法:');
    console.log('1. 启动此代理服务器');
    console.log('2. 在Web应用中将API请求发送到代理服务器');
    console.log('3. 代理服务器会自动转发到对应的API');
    console.log('');
    if (USE_HTTPS) {
        console.log('注意: 使用自签名证书，浏览器可能显示安全警告');
    }
});

/**
 * 处理搜索API请求
 */
function handleSearchRequest(req, res) {
    // 只允许POST请求
    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '只允许POST请求' }));
        return;
    }

    // 收集请求体数据
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', () => {
        try {
            // 验证请求体是否为有效JSON
            const requestData = JSON.parse(body);

            // 验证必需字段
            if (!requestData.q) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '缺少必需的搜索词参数' }));
                return;
            }

            console.log('收到搜索请求:', requestData);

            // 转发请求到搜索API
            forwardSearchRequest(requestData, res);

        } catch (error) {
            console.error('解析搜索请求体错误:', error);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '无效的JSON格式' }));
        }
    });
}

/**
 * 转发搜索请求到目标API
 */
function forwardSearchRequest(requestData, clientRes) {
    const postData = JSON.stringify(requestData);

    const options = {
        hostname: 'hunhepan.com',
        port: 443,
        path: '/open/search/disk',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    };

    const proxyReq = https.request(options, (proxyRes) => {
        console.log(`搜索API响应状态: ${proxyRes.statusCode}`);

        // 设置响应头
        clientRes.writeHead(proxyRes.statusCode, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true'
        });

        let responseData = '';

        proxyRes.on('data', (chunk) => {
            responseData += chunk;
        });

        proxyRes.on('end', () => {
            try {
                // 记录原始响应数据
                console.log('搜索API原始响应:', responseData.substring(0, 500) + (responseData.length > 500 ? '...' : ''));

                // 验证响应是否为有效JSON
                const parsedData = JSON.parse(responseData);
                console.log('搜索API响应成功，数据结构:', Object.keys(parsedData));

                // 如果有data字段，也记录其结构
                if (parsedData.data) {
                    console.log('data字段类型:', Array.isArray(parsedData.data) ? 'Array' : typeof parsedData.data);
                    if (parsedData.data.list) {
                        console.log('搜索结果数量:', Array.isArray(parsedData.data.list) ? parsedData.data.list.length : 'null');
                    }
                }

                clientRes.end(responseData);
            } catch (error) {
                console.error('搜索API响应不是有效JSON:', error);
                console.error('响应内容:', responseData);
                clientRes.writeHead(500, { 'Content-Type': 'application/json' });
                clientRes.end(JSON.stringify({
                    error: '搜索API响应格式错误',
                    details: responseData.substring(0, 200),
                    rawResponse: responseData
                }));
            }
        });
    });

    proxyReq.on('error', (error) => {
        console.error('请求搜索API错误:', error);
        clientRes.writeHead(500, { 'Content-Type': 'application/json' });
        clientRes.end(JSON.stringify({
            error: '请求搜索API失败',
            details: error.message
        }));
    });

    // 发送请求数据
    proxyReq.write(postData);
    proxyReq.end();
}

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n正在关闭代理服务器...');
    server.close(() => {
        console.log('代理服务器已关闭');
        process.exit(0);
    });
});
