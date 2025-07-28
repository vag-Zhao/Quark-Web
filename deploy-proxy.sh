#!/bin/bash

# 夸克网盘转存工具 - 代理服务器部署脚本
# 用于在云服务器上部署CORS代理服务器

echo "=== 夸克网盘转存工具 - 代理服务器部署脚本 ==="
echo ""

# 检查Node.js是否已安装
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    echo "   Ubuntu/Debian: sudo apt update && sudo apt install nodejs npm"
    echo "   CentOS/RHEL: sudo yum install nodejs npm"
    echo "   或访问 https://nodejs.org/ 下载安装"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"
echo "✅ npm 版本: $(npm --version)"
echo ""

# 检查是否有proxy-server.js文件
if [ ! -f "proxy-server.js" ]; then
    echo "❌ 未找到 proxy-server.js 文件"
    echo "   请确保在正确的目录中运行此脚本"
    exit 1
fi

echo "✅ 找到 proxy-server.js 文件"
echo ""

# 检查端口8081是否被占用
if netstat -tuln | grep -q ":8081 "; then
    echo "⚠️  端口 8081 已被占用"
    echo "   正在尝试停止现有进程..."
    
    # 尝试停止现有的代理服务器进程
    pkill -f "node.*proxy-server.js" || true
    sleep 2
    
    if netstat -tuln | grep -q ":8081 "; then
        echo "❌ 无法释放端口 8081，请手动停止占用该端口的进程"
        echo "   使用命令: sudo lsof -i :8081"
        echo "   然后: sudo kill -9 <PID>"
        exit 1
    fi
fi

echo "✅ 端口 8081 可用"
echo ""

# 创建systemd服务文件（可选）
read -p "是否创建 systemd 服务以便开机自启动？(y/n): " create_service

if [ "$create_service" = "y" ] || [ "$create_service" = "Y" ]; then
    echo "正在创建 systemd 服务..."
    
    # 获取当前目录的绝对路径
    CURRENT_DIR=$(pwd)
    
    # 创建服务文件
    sudo tee /etc/systemd/system/quark-proxy.service > /dev/null <<EOF
[Unit]
Description=Quark GUI CORS Proxy Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$CURRENT_DIR
ExecStart=/usr/bin/node $CURRENT_DIR/proxy-server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=8081
Environment=HOST=0.0.0.0

[Install]
WantedBy=multi-user.target
EOF

    # 重新加载systemd配置
    sudo systemctl daemon-reload
    
    # 启用服务
    sudo systemctl enable quark-proxy.service
    
    echo "✅ systemd 服务已创建并启用"
    echo ""
fi

# 启动代理服务器
echo "正在启动代理服务器..."
echo ""

if [ "$create_service" = "y" ] || [ "$create_service" = "Y" ]; then
    # 使用systemd启动
    sudo systemctl start quark-proxy.service
    sleep 3
    
    if sudo systemctl is-active --quiet quark-proxy.service; then
        echo "✅ 代理服务器已通过 systemd 启动"
        echo ""
        echo "服务管理命令:"
        echo "  查看状态: sudo systemctl status quark-proxy"
        echo "  停止服务: sudo systemctl stop quark-proxy"
        echo "  重启服务: sudo systemctl restart quark-proxy"
        echo "  查看日志: sudo journalctl -u quark-proxy -f"
    else
        echo "❌ systemd 服务启动失败"
        echo "   正在尝试直接启动..."
        nohup node proxy-server.js > proxy.log 2>&1 &
        echo $! > proxy.pid
    fi
else
    # 直接启动
    nohup node proxy-server.js > proxy.log 2>&1 &
    echo $! > proxy.pid
    sleep 2
    
    if ps -p $(cat proxy.pid) > /dev/null 2>&1; then
        echo "✅ 代理服务器已启动 (PID: $(cat proxy.pid))"
        echo ""
        echo "管理命令:"
        echo "  查看日志: tail -f proxy.log"
        echo "  停止服务: kill \$(cat proxy.pid)"
    else
        echo "❌ 代理服务器启动失败"
        echo "   请查看日志: cat proxy.log"
        exit 1
    fi
fi

echo ""
echo "=== 部署完成 ==="
echo ""
echo "代理服务器信息:"
echo "  地址: http://$(hostname -I | awk '{print $1}'):8081"
echo "  健康检查: http://$(hostname -I | awk '{print $1}'):8081/health"
echo ""
echo "防火墙配置:"
echo "  请确保防火墙允许 8081 端口的入站连接"
echo "  Ubuntu/Debian: sudo ufw allow 8081"
echo "  CentOS/RHEL: sudo firewall-cmd --permanent --add-port=8081/tcp && sudo firewall-cmd --reload"
echo ""
echo "前端配置:"
echo "  在前端应用的设置中，将代理URL设置为:"
echo "  http://你的服务器IP:8081"
echo "  或者前端会自动检测并使用正确的代理URL"
echo ""
