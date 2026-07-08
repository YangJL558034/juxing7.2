# Nginx WebSocket 反向代理

聚星实时聊天使用 Socket.IO，默认路径是 `/socket.io`。Linux 部署到 Nginx 后，需要给 WebSocket 单独保留 `Upgrade` 头。

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

生产环境建议用 `pnpm build` 后通过 `pnpm start` 或项目部署脚本启动同一个 `src/server.ts` 自定义服务端。
