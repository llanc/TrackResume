# TrackResume

TrackResume is a privacy-aware resume sharing and tracking portal built on Cloudflare Workers.
It helps candidates send a recruiter-specific resume link that opens a PDF immediately, while keeping access scoped, observable, and easy to revoke.

TrackResume 是一个基于 Cloudflare Workers 的简历分发与访问追踪项目。
它的目标是让求职者向招聘方发送“专属简历链接”，对方打开后即可直接查看 PDF，同时尽量控制访问范围、记录查看行为，并支持随时停用链接。

## Overview | 项目概览

TrackResume is designed for a common hiring workflow problem:
many recruiting platforms require the recruiter to reply first, or only expose limited in-app profile fields, which means your actual PDF resume is often ignored.

TrackResume solves this by providing:

- A dedicated resume link for each recruiter or company
- Direct in-browser PDF viewing
- Private access through unlisted, hard-to-guess links
- Visit tracking for page open, PDF load, and download events
- A lightweight admin panel for upload, link creation, and link revocation

TrackResume 解决的是一个非常现实的问题：
很多招聘平台要求对方先回复，或者只展示平台内的简历表单，导致精心准备的 PDF 简历反而不容易被看到。

TrackResume 提供了下面这些能力：

- 为每个招聘者或公司生成单独的简历链接
- 打开链接即可直接在线查看 PDF
- 使用不可枚举的私有链接，而不是公开目录页
- 记录页面打开、PDF 加载、PDF 下载等访问行为
- 提供轻量后台用于上传简历、创建链接和停用链接

## Features | 核心特性

### English

- Recruiter-specific share links
- Cloudflare Worker-based server-side rendering
- Resume PDF storage with Cloudflare R2
- Visit and event logging with Cloudflare D1
- Admin authentication with secure cookies
- Link expiration and manual revocation
- Privacy-oriented defaults such as `noindex`, `noarchive`, and hashed IP logging
- GitHub-to-Cloudflare deployment workflow
- Automatic D1 migration on production deployment

### 中文

- 面向招聘对象的一对一专属链接
- 基于 Cloudflare Worker 的服务端渲染
- 使用 Cloudflare R2 存储 PDF 简历
- 使用 Cloudflare D1 记录访问与行为日志
- 后台密码登录与安全 Cookie 会话
- 支持链接过期和手动停用
- 默认偏隐私保护：`noindex`、`noarchive`、IP 哈希化存储
- 支持 GitHub 连接 Cloudflare 的自动部署
- 支持生产环境部署时自动执行 D1 migration

## Demo Flow | 使用流程

### English

1. Upload the current resume PDF in the admin panel.
2. Create a unique share link for a recruiter, company, or role.
3. Send that link in the first contact message.
4. The recruiter opens the link and sees the PDF immediately.
5. TrackResume records page open, PDF load, and download activity.
6. Revoke the link at any time if needed.

### 中文

1. 在后台上传当前 PDF 简历。
2. 为某个招聘者、公司或岗位创建唯一分享链接。
3. 在打招呼消息里直接发送这个链接。
4. 对方打开链接后即可直接查看 PDF。
5. TrackResume 会记录页面打开、PDF 加载和下载行为。
6. 如果需要，你可以随时停用这条链接。

## Architecture | 技术架构

### English

- Cloudflare Workers
  Handles routing, server-rendered pages, admin actions, authentication, and public share pages.
- Cloudflare R2
  Stores the active resume PDF.
- Cloudflare D1
  Stores share links, settings, and access events.
- GitHub + Workers Builds
  Builds and deploys the project from the repository.

### 中文

- Cloudflare Workers
  负责路由、页面渲染、后台操作、认证和公开分享页。
- Cloudflare R2
  存储当前生效的 PDF 简历。
- Cloudflare D1
  存储分享链接、系统设置和访问日志。
- GitHub + Workers Builds
  负责从仓库自动构建和部署。

## Repository Structure | 仓库结构

```text
.
├─ src/
│  ├─ index.ts        # Worker entry and request routing
│  ├─ html.ts         # Server-rendered page templates
│  ├─ db.ts           # D1 access and event persistence
│  ├─ utils.ts        # Shared helpers
│  └─ types.ts        # Shared types and constants
├─ migrations/
│  └─ 0001_init.sql   # Initial D1 schema
├─ wrangler.jsonc     # Worker project configuration
├─ package.json
└─ README.md
```

## Deployment | 部署方式

### Recommended

GitHub -> Cloudflare Workers Builds.

### English

1. Push this repository to GitHub.
2. Import the repository in Cloudflare Workers.
3. Set the production branch to `main`.
4. Set the production deploy command to `npm run deploy`.
5. Configure the required secrets in Cloudflare Dashboard.
6. Ensure D1 and R2 bindings are correctly attached.

TrackResume is currently configured for production-only deployment.
Preview branches are intentionally not part of the default workflow.

### 中文

1. 将本仓库推送到 GitHub。
2. 在 Cloudflare Workers 中导入该仓库。
3. 生产分支设置为 `main`。
4. 生产环境部署命令设置为 `npm run deploy`。
5. 在 Cloudflare Dashboard 中配置必需的 Secret。
6. 确认 D1 和 R2 绑定已正确添加。

TrackResume 当前按“仅生产分支”策略设计。
默认不启用 preview 分支部署。

## Automatic Database Migration | 自动数据库迁移

### English

Production deployment runs D1 migrations automatically before deploying the Worker:

```bash
npm run deploy
```

This executes:

```bash
wrangler d1 migrations apply DB --remote
wrangler deploy
```

Applied migrations are tracked by D1, so only pending migrations are executed.

### 中文

生产环境部署时，会先自动执行 D1 migration，再部署 Worker：

```bash
npm run deploy
```

实际执行逻辑是：

```bash
wrangler d1 migrations apply DB --remote
wrangler deploy
```

D1 会记录已经执行过的 migration，因此每次部署只会补跑尚未执行的变更。

## Required Configuration | 必要配置

### Cloudflare Secrets

- `ADMIN_PASSWORD`
- `SESSION_SECRET`

### Worker Variables

- `SITE_OWNER_NAME`
- `SITE_OWNER_TITLE`
- `SITE_INTRO`
- `ALLOW_DOWNLOAD_BUTTON`
- `LINK_EXPIRE_DAYS`

### Resource Bindings

- `DB` for the D1 database
- `RESUME_BUCKET` for the R2 bucket

## Security and Privacy Notes | 安全与隐私说明

### English

- Share links are private but not cryptographically private once forwarded.
- Recruiters can still save or forward the PDF after opening it.
- The system stores hashed IP values instead of plain IP addresses.
- Secrets must never be committed to the repository.
- Resource identifiers such as D1 database IDs and bucket names are not secrets, but they are still metadata that should be handled deliberately.

### 中文

- 分享链接是“非公开链接”，但一旦被转发，就不能再保证只由原始接收者使用。
- 招聘方打开 PDF 后，依然可能保存或转发文件。
- 系统记录的是 IP 哈希值，而不是明文 IP。
- Secret 绝不能提交到仓库。
- D1 数据库 ID、R2 bucket 名这类资源标识不是密钥，但仍属于应谨慎暴露的元信息。

## Project Status | 项目状态

TrackResume is functional and deployable.
The current version focuses on a minimal, production-ready MVP for secure resume delivery and recruiter access tracking.

TrackResume 当前已经可以部署和使用。
现阶段重点是一个可上线的 MVP，用来完成私密简历分发与招聘访问追踪这两个核心目标。

## Roadmap | 路线图

### English

- Custom branding and visual themes
- Multi-file resume support
- Better event analytics and export
- Optional per-link access controls
- Admin audit trail

### 中文

- 自定义品牌信息与主题样式
- 多份简历文件支持
- 更细致的访问分析与导出
- 可选的单链接访问限制策略
- 后台审计日志

## Development | 本地开发

```bash
npm install
npm run check
```

If you want to run local development with Wrangler, you still can, but local Wrangler usage is not required for the standard GitHub-to-Cloudflare deployment flow.

如果你愿意，本地仍然可以使用 Wrangler 做开发调试；但对于当前推荐的 GitHub -> Cloudflare 部署流程，并不要求你在本地手动使用 Wrangler。

## License | 许可证

No license file has been added yet.
Add a proper open-source license before publishing this project as a public OSS repository.

当前仓库还没有添加许可证文件。
如果你准备把它作为公开开源项目长期维护，建议补充正式的开源许可证。
