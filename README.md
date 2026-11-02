# 01-todo-api-frontend

`01-todo-api`（Go + Gin + SQLite）的配套前端，Vue 3 + Vite 5，覆盖后端已有的全部接口。

## 功能覆盖

| 页面能力 | 对应接口 |
|---|---|
| 后端连接状态 | `GET /api/health` |
| 统计卡片（总数/待办/已完成/完成率） | `GET /api/todos/statistics` |
| 列表、分页、状态/优先级筛选、搜索 | `GET /api/todos` |
| 新建任务 | `POST /api/todos` |
| 编辑任务（含状态、优先级、截止日期） | `PUT /api/todos/:id` |
| 勾选切换完成状态 | `PATCH /api/todos/:id/toggle` |
| 删除任务 | `DELETE /api/todos/:id` |

后端尚未提供的功能（标签、评论、附件、JWT 登录等）本前端不做假实现。

## 目录结构

```
01-todo-api-frontend/
├── index.html
├── package.json
├── vite.config.js      # 开发服务器与 /api 代理
├── .env.example        # 后端地址配置示例
└── src/
    ├── main.js
    ├── api.js          # 请求封装，统一错误处理
    ├── App.vue         # 页面与交互
    └── style.css
```

## 启动

先确保后端已运行在 `http://127.0.0.1:8080`（见 `../01-todo-api/README.md`）。

```bash
cd D:\桌面\project\01-todo-api-frontend
npm install      # 首次或依赖变更后执行
npm run dev
```

打开 <http://127.0.0.1:5173>。

生产构建与本地预览：

```bash
npm run build
npm run preview
```

## 后端地址与代理

### 方式一：Vite 代理（默认）

`src/api.js` 的 `BASE_URL` 为空，请求 `/api/...` 由 Vite 转发，浏览器视角同源，无跨域问题。

默认转发到 `http://127.0.0.1:8080`，在后端地址变化时用环境变量覆盖：

```bash
# .env.local
VITE_PROXY_TARGET=http://192.168.1.20:9000
```

对应配置位于 `vite.config.js`：

```js
server: {
  host: '127.0.0.1',
  port: 5173,
  proxy: {
    '/api': { target: env.VITE_PROXY_TARGET || 'http://127.0.0.1:8080', changeOrigin: true },
  },
}
```

### 方式二：浏览器直连后端

后端已启用 CORS，可跳过代理直接请求完整地址：

```bash
# .env.local
VITE_API_BASE=http://127.0.0.1:8080
```

## 说明

- 开发服务器显式绑定 `127.0.0.1`，避免 Vite 只监听 IPv6 `[::1]` 导致 `127.0.0.1` 访问失败。
- 修改 `.env*` 或 `vite.config.js` 后需重启 `npm run dev`。
- 搜索输入做了 350ms 防抖；删除前有确认弹窗；错误信息取自后端 `message` + `error` 字段。
