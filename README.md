# Private Resume Worker

一个部署在 Cloudflare Workers 上的私密简历站点，支持直接从 GitHub 导入到 Cloudflare 自动部署。

## 不想用 Wrangler，能不能部署

可以。

截至 2026-03-30，Cloudflare 官方支持把 GitHub 仓库直接连接到 Workers 做自动构建和部署。你不需要在本地安装、登录或运行 Wrangler CLI。你只需要：

- 把代码推到 GitHub
- 在 Cloudflare Dashboard 导入仓库
- 在 Dashboard 里配置 Secret、D1、R2
- 在 D1 的 SQL 控制台执行初始化 SQL

这个仓库里仍然保留了 [wrangler.jsonc](/C:/Users/liulancong/Desktop/Resume/wrangler.jsonc)，但它只是给 Cloudflare 构建系统读的项目配置文件，不要求你手动运行 Wrangler。

## 当前项目状态

这个仓库已经可以直接用于 GitHub -> Cloudflare Workers 部署：

- 入口文件是 [src/index.ts](/C:/Users/liulancong/Desktop/Resume/src/index.ts)
- 页面渲染是 [src/html.ts](/C:/Users/liulancong/Desktop/Resume/src/html.ts)
- 数据访问和日志在 [src/db.ts](/C:/Users/liulancong/Desktop/Resume/src/db.ts)
- 数据库初始化 SQL 在 [0001_init.sql](/C:/Users/liulancong/Desktop/Resume/migrations/0001_init.sql)
- Node 版本通过 [`.node-version`](/C:/Users/liulancong/Desktop/Resume/.node-version) 固定为 `22`

## 你该怎么做

### 1. 推到 GitHub

把当前目录推到你的 GitHub 仓库。

如果还没初始化 Git：

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

### 2. 在 Cloudflare 导入 GitHub 仓库

路径：

`Workers & Pages` -> `Create application` -> `Import a repository`

然后：

1. 授权 Cloudflare 访问你的 GitHub
2. 选择你的仓库
3. 生产分支选 `main`
4. `Root directory` 留空
5. `Build command` 留空
6. `Deploy command` 保持默认
7. 保存并部署

如果 Cloudflare 是让你连接到“已有 Worker”，那 Cloudflare 里的 Worker 名称必须和 [wrangler.jsonc](/C:/Users/liulancong/Desktop/Resume/wrangler.jsonc) 里的 `name` 一致。

### 3. 在 Dashboard 创建或确认资源

到 Cloudflare Dashboard 里创建或确认这两个资源存在：

- 一个 D1 数据库
- 一个 R2 bucket

路径通常是：

- `Storage & databases` -> `D1`
- `Storage & databases` -> `R2`

如果你当前 [wrangler.jsonc](/C:/Users/liulancong/Desktop/Resume/wrangler.jsonc) 里已经填了真实的 `database_id` 和 `bucket_name`，那就确保 Dashboard 里的资源和这些配置对应一致。

### 4. 配置 Secret

到：

`Workers & Pages` -> 你的 Worker -> `Settings` -> `Variables and Secrets`

添加两个 Secret：

- `ADMIN_PASSWORD`
- `SESSION_SECRET`

这两个不要提交到 GitHub。

### 5. 初始化 D1 数据库

如果你不想用 Wrangler CLI，就不要跑 `wrangler d1 migrations apply`。

直接打开 D1 的 SQL 控制台，把 [0001_init.sql](/C:/Users/liulancong/Desktop/Resume/migrations/0001_init.sql) 的内容整段复制进去执行即可。

这一步会创建：

- `settings`
- `share_links`
- `view_events`

以及对应索引。

### 6. 重新部署一次

如果你是在首次部署后才补充 Secret 或资源配置，建议到：

`Workers & Pages` -> 你的 Worker -> `Deployments`

重新部署最新提交一次。

### 7. 开始使用

访问：

```text
https://你的域名/admin/login
```

然后：

- 登录后台
- 上传 PDF 简历
- 创建招聘方专属链接
- 把链接直接发给对方

## 哪些文件你可能要改

你自己最可能要改的是 [wrangler.jsonc](/C:/Users/liulancong/Desktop/Resume/wrangler.jsonc) 里的展示信息：

- `name`
- `SITE_OWNER_NAME`
- `SITE_OWNER_TITLE`
- `SITE_INTRO`
- `ALLOW_DOWNLOAD_BUTTON`
- `LINK_EXPIRE_DAYS`

如果你已经有自己的 D1 / R2 资源，也确认一下：

- `d1_databases[0].database_id`
- `d1_databases[0].preview_database_id`
- `r2_buckets[0].bucket_name`

## 我对你这个要求的建议

你说“不想使用 Wrangler”，如果意思是“不想自己在本地跑 Wrangler CLI”，那现在这套已经满足。

最实际的部署方式就是：

- 本地只管 Git
- Cloudflare 里只用 Dashboard
- 数据库初始化用 D1 SQL 控制台

这是目前最省事的路径。

## 官方文档

- Workers Builds: https://developers.cloudflare.com/workers/ci-cd/builds/
- Git integration: https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/
- Builds configuration: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- D1 get started: https://developers.cloudflare.com/d1/get-started/
- R2 create buckets: https://developers.cloudflare.com/r2/buckets/create-buckets/
