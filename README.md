# Private Resume Worker

一个部署在 Cloudflare Workers 上的私密简历站点，支持直接从 GitHub 导入到 Cloudflare 自动部署。

## 不想用 Wrangler，能不能部署

可以。

截至 2026-03-30，Cloudflare 官方支持把 GitHub 仓库直接连接到 Workers 做自动构建和部署。你不需要在本地安装、登录或运行 Wrangler CLI。你只需要：

- 把代码推到 GitHub
- 在 Cloudflare Dashboard 导入仓库
- 在 Dashboard 里配置 Secret、D1、R2
- 让 Cloudflare 在生产部署时自动执行 D1 migration

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
6. 生产环境的 `Deploy command` 改成 `npm run deploy`
7. 保存并部署

如果 Cloudflare 是让你连接到“已有 Worker”，那 Cloudflare 里的 Worker 名称必须和 [wrangler.jsonc](/C:/Users/liulancong/Desktop/Resume/wrangler.jsonc) 里的 `name` 一致。

这里的 `npm run deploy` 已经被我改成：

```bash
npm run db:migrations:apply && wrangler deploy
```

而 `db:migrations:apply` 实际执行的是：

```bash
wrangler d1 migrations apply DB --remote
```

也就是说，Cloudflare 在生产部署时会先检查并应用 [migrations/0001_init.sql](/C:/Users/liulancong/Desktop/Resume/migrations/0001_init.sql) 这类 migration，然后再部署 Worker。

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

### 5. 自动初始化 D1 数据库

这个项目现在已经支持在 Cloudflare 生产部署时自动执行 migration。

D1 官方文档说明：

- `wrangler d1 migrations apply [DATABASE] --remote` 会把 migration 应用到远程数据库
- `[DATABASE]` 可以用绑定名或数据库名
- migration 的执行记录会保存到 `d1_migrations` 表

所以这条命令每次部署都跑也没有问题，它只会应用“还没执行过”的 migration。

这个仓库当前用的是 Cloudflare 官方推荐的绑定名写法：

```bash
wrangler d1 migrations apply DB --remote
```

这样即使以后数据库名字变了，只要绑定还是 `DB`，脚本依然能工作。

### 6. 只保留生产分支

你既然只想保留生产分支，那 Cloudflare 里就只部署 `main`。

建议做法：

- 生产分支 `main`：`Deploy command` 用 `npm run deploy`
- 关闭所有非生产分支 / preview 自动部署

这样最干净，也不会出现 preview 分支误连正式 D1 的问题。

### 7. 手动 SQL 初始化现在只是兜底方案

如果你不想用 Wrangler CLI，就不要跑 `wrangler d1 migrations apply`。

正常情况下，Cloudflare 在生产部署时会自动执行 migration，不需要你手动打开 SQL 控制台。

只有在下面这种情况，才建议手动执行 SQL：

- 你还没把 Cloudflare 的生产 `Deploy command` 改成 `npm run deploy`
- 或者你只想临时补一次初始化，不想重新触发部署

这时你可以直接打开 D1 的 SQL 控制台，把 [0001_init.sql](/C:/Users/liulancong/Desktop/Resume/migrations/0001_init.sql) 的内容整段复制进去执行。

这一步会创建：

- `settings`
- `share_links`
- `view_events`

以及对应索引。

### 8. 重新部署一次

如果你是在首次部署后才补充 Secret 或资源配置，建议到：

`Workers & Pages` -> 你的 Worker -> `Deployments`

重新部署最新提交一次。

### 9. 开始使用

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
- `r2_buckets[0].bucket_name`

## 我对你这个要求的建议

你说“不想使用 Wrangler”，如果意思是“不想自己在本地跑 Wrangler CLI”，那现在这套已经满足。

最实际的部署方式现在是：

- 本地只管 Git
- Cloudflare 里只用 Dashboard
- 生产部署时自动跑 migration

这是目前最省事的路径。

## 官方文档

- Workers Builds: https://developers.cloudflare.com/workers/ci-cd/builds/
- Git integration: https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/
- Builds configuration: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- D1 migrations: https://developers.cloudflare.com/d1/reference/migrations/
- D1 wrangler commands: https://developers.cloudflare.com/d1/wrangler-commands/
- Deploy buttons package.json migration example: https://developers.cloudflare.com/workers/platform/deploy-buttons/
- D1 get started: https://developers.cloudflare.com/d1/get-started/
- R2 create buckets: https://developers.cloudflare.com/r2/buckets/create-buckets/
