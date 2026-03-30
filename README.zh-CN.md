# TrackResume

[English](./README.md)

TrackResume 是一个基于 Cloudflare Workers 的简历分发与访问追踪项目。
它的目标是让求职者向招聘方发送“专属简历链接”，对方打开后即可直接查看 PDF，同时尽量控制访问范围、记录查看行为，并支持随时停用链接。

## 项目概览

TrackResume 解决的是一个非常现实的问题：很多招聘平台要求对方先回复，或者只展示平台内的简历表单，导致精心准备的 PDF 简历反而不容易被看到。

TrackResume 提供了下面这些能力：

- 为每个招聘者或公司生成单独的简历链接
- 打开链接即可直接在线查看 PDF
- 使用不可枚举的私有链接，而不是公开目录页
- 记录页面打开、PDF 加载、PDF 下载等访问行为
- 提供轻量后台用于上传简历、创建链接和停用链接

## 核心特性

- 面向招聘对象的一对一专属链接
- 基于 Cloudflare Worker 的服务端渲染
- 使用 Cloudflare R2 存储 PDF 简历
- 使用 Cloudflare D1 记录访问与行为日志
- 后台密码登录与安全 Cookie 会话
- 支持链接过期和手动停用
- 默认偏隐私保护：`noindex`、`noarchive`、IP 哈希化存储
- 支持 GitHub 连接 Cloudflare 的自动部署
- 支持部署时自动执行 D1 migration

## 使用流程

1. 在后台上传当前 PDF 简历。
2. 为某个招聘者、公司或岗位创建唯一分享链接。
3. 在打招呼消息里直接发送这个链接。
4. 对方打开链接后即可直接查看 PDF。
5. TrackResume 会记录页面打开、PDF 加载和下载行为。
6. 如果需要，你可以随时停用这条链接。

## 技术架构

- Cloudflare Workers
  负责路由、页面渲染、后台操作、认证和公开分享页。
- Cloudflare R2
  存储当前生效的 PDF 简历。
- Cloudflare D1
  存储分享链接、系统设置和访问日志。
- GitHub + Workers Builds
  负责从仓库自动构建和部署。

## 仓库结构

```text
.
├─ src/
│  ├─ index.ts        # Worker 入口与路由
│  ├─ html.ts         # 服务端页面模板
│  ├─ db.ts           # D1 数据访问与事件记录
│  ├─ utils.ts        # 通用辅助函数
│  └─ types.ts        # 共享类型与常量
├─ migrations/
│  └─ 0001_init.sql   # 初始 D1 数据库结构
├─ wrangler.jsonc     # Worker 项目配置
├─ package.json
└─ README.md
```

## 部署方式

推荐流程：

GitHub -> Cloudflare Workers Builds

1. 将本仓库推送到 GitHub。
2. 在 Cloudflare Workers 中导入该仓库。
3. 部署命令设置为 `npm run deploy`。
4. 在 Cloudflare Dashboard 中配置必需的 Secret。
5. 确认 D1 和 R2 绑定已正确添加。

TrackResume 当前按单一部署流程配置。

## 自动数据库迁移

部署时，会先自动执行 D1 migration，再部署 Worker：

```bash
npm run deploy
```

实际执行逻辑是：

```bash
wrangler d1 migrations apply DB --remote
wrangler deploy
```

D1 会记录已经执行过的 migration，因此每次部署只会补跑尚未执行的变更。

## 必要配置

### Cloudflare Secrets

- `ADMIN_PASSWORD` — 用于登录 `/admin` 后台的密码。
- `SESSION_SECRET` — 一个足够长的随机字符串，承担两项职责：(1) 对管理员登录后的 Session Cookie 进行签名与验签，确保只有合法登录才能访问后台；(2) 作为盐值对访客 IP 进行哈希，使数据库中只存储哈希值而非明文 IP，保护访客隐私。

### Worker Variables

- `SITE_OWNER_NAME`
- `SITE_OWNER_TITLE`
- `SITE_INTRO`
- `ALLOW_DOWNLOAD_BUTTON`
- `LINK_EXPIRE_DAYS`

### 资源绑定

- `DB` 绑定到 D1 数据库
- `RESUME_BUCKET` 绑定到 R2 bucket

## 安全与隐私说明

- 分享链接是“非公开链接”，但一旦被转发，就不能再保证只由原始接收者使用。
- 招聘方打开 PDF 后，依然可能保存或转发文件。
- 系统记录的是 IP 哈希值，而不是明文 IP。
- Secret 绝不能提交到仓库。
- D1 数据库 ID、R2 bucket 名这类资源标识不是密钥，但仍属于应谨慎暴露的元信息。

## 项目状态

TrackResume 当前已经可以部署和使用。
现阶段重点是一个可上线的 MVP，用来完成私密简历分发与招聘访问追踪这两个核心目标。

## 路线图

- 自定义品牌信息与主题样式
- 多份简历文件支持
- 更细致的访问分析与导出
- 可选的单链接访问限制策略
- 后台审计日志

## 本地开发

```bash
npm install
npm run check
```

如果你愿意，本地仍然可以使用 Wrangler 做开发调试；但对于当前推荐的 GitHub -> Cloudflare 部署流程，并不要求你在本地手动使用 Wrangler。

## 许可证

本项目采用 MIT License。
详见 [LICENSE](./LICENSE)。
