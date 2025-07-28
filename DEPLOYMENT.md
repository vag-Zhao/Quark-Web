# 夸克网盘转存工具 - 云服务器部署指南

## 问题描述

当你将前端应用部署到云服务器时，会遇到CORS（跨域资源共享）问题，因为浏览器的安全策略阻止了从你的域名直接访问夸克网盘的API。

## 解决方案

部署一个CORS代理服务器来转发API请求，解决跨域问题。

## 部署步骤

### 1. 上传文件到服务器

将以下文件上传到你的云服务器：
- `proxy-server.js` - 代理服务器主文件
- `deploy-proxy.sh` - 部署脚本
- `stop-proxy.sh` - 停止脚本

### 2. 运行部署脚本

```bash
# 进入项目目录
cd /path/to/your/project

# 运行部署脚本
./deploy-proxy.sh
```

部署脚本会：
- 检查Node.js环境
- 检查端口可用性
- 可选创建systemd服务
- 启动代理服务器

### 3. 配置防火墙

确保防火墙允许8081端口的入站连接：

**Ubuntu/Debian:**
```bash
sudo ufw allow 8081
```

**CentOS/RHEL:**
```bash
sudo firewall-cmd --permanent --add-port=8081/tcp
sudo firewall-cmd --reload
```

### 4. 验证部署

访问健康检查端点：
```
http://你的服务器IP:8081/health
```

应该返回类似以下的JSON响应：
```json
{
  "status": "ok",
  "timestamp": "2025-07-25T10:30:00.000Z"
}
```

## 前端配置

前端应用会自动检测环境并使用正确的代理URL：

- **本地开发**: `http://localhost:8081`
- **生产环境**: `http://你的域名:8081`

如果需要手动配置，可以在前端应用的设置中指定代理URL。

## 服务管理

### 使用systemd（推荐）

如果在部署时选择了创建systemd服务：

```bash
# 查看服务状态
sudo systemctl status quark-proxy

# 停止服务
sudo systemctl stop quark-proxy

# 启动服务
sudo systemctl start quark-proxy

# 重启服务
sudo systemctl restart quark-proxy

# 查看日志
sudo journalctl -u quark-proxy -f
```

### 手动管理

如果没有使用systemd：

```bash
# 查看日志
tail -f proxy.log

# 停止服务
./stop-proxy.sh

# 重新启动
./deploy-proxy.sh
```

## 环境变量

可以通过环境变量配置代理服务器：

```bash
# 设置端口（默认8081）
export PORT=8081

# 设置监听地址（默认0.0.0.0）
export HOST=0.0.0.0

# 启动服务器
node proxy-server.js
```

## 故障排除

### 1. 端口被占用

```bash
# 查看占用8081端口的进程
sudo lsof -i :8081

# 停止进程
sudo kill -9 <PID>
```

### 2. 权限问题

确保脚本有执行权限：
```bash
chmod +x deploy-proxy.sh stop-proxy.sh
```

### 3. Node.js未安装

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install nodejs npm
```

**CentOS/RHEL:**
```bash
sudo yum install nodejs npm
```

### 4. 防火墙阻止连接

检查防火墙状态并开放端口：
```bash
# Ubuntu
sudo ufw status
sudo ufw allow 8081

# CentOS
sudo firewall-cmd --list-all
sudo firewall-cmd --permanent --add-port=8081/tcp
sudo firewall-cmd --reload
```

### 5. 服务无法启动

查看详细日志：
```bash
# systemd服务
sudo journalctl -u quark-proxy -f

# 手动启动
cat proxy.log
```

## 支持的域名

代理服务器默认允许以下域名访问：
- `http://localhost:3000`
- `http://127.0.0.1:5501`
- `自己的域名`

如需添加其他域名，请修改 `proxy-server.js` 中的 `ALLOWED_ORIGINS` 数组。
