#!/bin/bash

# 夸克网盘转存工具 - 停止代理服务器脚本

echo "=== 停止代理服务器 ==="
echo ""

# 检查是否有systemd服务
if systemctl list-units --full -all | grep -Fq "quark-proxy.service"; then
    echo "发现 systemd 服务，正在停止..."
    sudo systemctl stop quark-proxy.service
    sudo systemctl disable quark-proxy.service
    echo "✅ systemd 服务已停止并禁用"
fi

# 停止通过PID文件启动的进程
if [ -f "proxy.pid" ]; then
    PID=$(cat proxy.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "正在停止进程 (PID: $PID)..."
        kill $PID
        sleep 2
        
        if ps -p $PID > /dev/null 2>&1; then
            echo "强制停止进程..."
            kill -9 $PID
        fi
        
        echo "✅ 进程已停止"
    else
        echo "进程已经停止"
    fi
    rm -f proxy.pid
fi

# 停止所有相关进程
echo "正在停止所有相关进程..."
pkill -f "node.*proxy-server.js" || true

echo ""
echo "✅ 代理服务器已停止"
echo ""
