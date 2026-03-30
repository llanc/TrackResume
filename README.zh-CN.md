# TrackResume

[English](./README.md)

TrackResume 是一个基于 Cloudflare Workers 的隐私优先简历分发与访问追踪项目。它适合为不同招聘方生成专属简历链接，让对方打开后直接查看 PDF，同时保持链接非公开、访问可观测、停用可控。

## 功能特性

- 面向招聘对象的一对一专属分享链接
- 浏览器内直接查看 PDF 简历
- 记录页面打开、PDF 加载、PDF 下载等关键访问事件
- 提供后台用于上传简历、创建链接和停用链接
- 基于 Cloudflare Workers、D1、R2 的原生架构
- 默认采用 `noindex`、`noarchive`、IP 哈希记录等隐私保护策略

## 典型使用流程

1. 在后台上传当前版本的 PDF 简历。
2. 为招聘者、公司或岗位创建唯一分享链接。
3. 在沟通消息中发送该链接。
4. 对方打开链接后可直接在浏览器中查看 PDF。
5. 系统记录关键访问事件。
6. 如有需要，可随时停用链接。

## 技术架构

- Cloudflare Workers：负责请求路由、服务端页面渲染、后台操作、认证与公开简历页
- Cloudflare D1：存储分享链接、运行时设置和访问事件
- Cloudflare R2：存储当前生效的 PDF 简历
- TypeScript：承载应用逻辑与 HTML 模板

## 部署

TrackResume 适合通过 Git 仓库接入 Cloudflare Workers 进行部署。

1. 将仓库推送到 GitHub。
2. 在 Cloudflare Dashboard 中从仓库创建 Worker 项目。
3. 将部署命令设置为 `npm run deploy`。
4. 在 Cloudflare Dashboard 中补齐必需的 Secret。
5. 检查 `wrangler.jsonc` 中的绑定与公开变量配置。
6. 执行部署。

## 配置说明

### Secrets

- `ADMIN_PASSWORD`：用于登录 `/admin` 后台的密码
- `SESSION_SECRET`：用于签名管理员会话 Cookie，并参与访客 IP 哈希计算的密钥

### Worker Variables

- `SITE_OWNER_NAME`：显示在首页和公开简历页的名称
- `SITE_OWNER_TITLE`：显示在公开简历页的副标题
- `SITE_INTRO`：显示在首页和简历查看页的一段简短介绍
- `ALLOW_DOWNLOAD_BUTTON`：设置为 `true` 时显示公开下载按钮
- `LINK_EXPIRE_DAYS`：新建分享链接时默认使用的过期天数

### 资源绑定

- `DB`：用于存储分享链接、设置和访问事件的 D1 数据库
- `RESUME_BUCKET`：用于存储当前生效 PDF 简历的 R2 bucket

## 仓库结构

```text
.
├─ src/
│  ├─ index.ts
│  ├─ html.ts
│  ├─ db.ts
│  ├─ utils.ts
│  └─ types.ts
├─ migrations/
│  └─ 0001_init.sql
├─ wrangler.jsonc
├─ package.json
└─ README.md
```

## 本地开发

```bash
npm install
npm run check
npm run dev
```

## 安全说明

- 分享链接是非公开链接，但一旦被转发，就无法保证只由原始接收者使用。
- 对方打开 PDF 后，仍然可以自行保存或转发文件。
- 系统记录的是 IP 哈希值，而不是明文 IP。
- Secret 应保存在 Cloudflare Dashboard 中，不应提交到仓库。

## 许可证

MIT，详见 [LICENSE](./LICENSE)。
