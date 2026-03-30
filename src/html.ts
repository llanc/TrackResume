import { getLinkAvailability } from './db';
import { ShareLink, ViewEvent } from './types';
import {
  addDays,
  escapeHtml,
  formatDateTime,
  formatFileSize,
  toDateTimeLocalInput,
} from './utils';

export function renderLandingPage(input: { ownerName: string; intro: string }): string {
  return renderLayout({
    title: input.ownerName,
    pageClass: 'centered',
    body: `
      <section class="panel hero">
        <div class="eyebrow">Private Resume Portal</div>
        <h1>${escapeHtml(input.ownerName)}</h1>
        <p>${escapeHtml(input.intro)}</p>
        <div class="actions">
          <a class="button" href="/admin/login">Admin Login</a>
        </div>
      </section>
    `,
  });
}

export function renderAdminLoginPage(message?: string): string {
  return renderLayout({
    title: 'Admin Login',
    pageClass: 'centered',
    body: `
      <section class="panel narrow">
        <div class="eyebrow">Admin</div>
        <h1>登录后台</h1>
        <p>使用部署到 Worker 的管理员密码进入管理界面。</p>
        ${message ? `<p class="error">${escapeHtml(message)}</p>` : ''}
        <form method="post" action="/admin/login" class="stack">
          <label>
            <span>管理员密码</span>
            <input type="password" name="password" autocomplete="current-password" required />
          </label>
          <button type="submit">进入后台</button>
        </form>
      </section>
    `,
  });
}

export function renderInvalidLinkPage(reason: string): string {
  return renderLayout({
    title: 'Link unavailable',
    pageClass: 'centered',
    body: `
      <section class="panel narrow">
        <div class="eyebrow">Access closed</div>
        <h1>这个简历链接当前不可用</h1>
        <p>${escapeHtml(reason)}</p>
      </section>
    `,
  });
}

export function renderPublicResumePage(input: {
  origin: string;
  link: ShareLink;
  ownerName: string;
  ownerTitle: string;
  intro: string;
  hasResume: boolean;
  allowDownloadButton: boolean;
}): string {
  const company = input.link.company_name || '招聘方';
  const recruiter = input.link.recruiter_name || '招聘负责人';
  const role = input.link.role_title || '岗位';
  const platform = input.link.platform_name || '招聘平台';
  const pdfUrl = `/r/${encodeURIComponent(input.link.slug)}/pdf`;
  const downloadUrl = `${pdfUrl}?download=1`;
  const watermark = `${company} · ${input.link.slug}`;

  return renderLayout({
    title: `${input.ownerName} Resume`,
    pageClass: 'viewer-page',
    body: `
      <section class="viewer-shell">
        <header class="viewer-header">
          <div>
            <div class="eyebrow">Private Resume Link</div>
            <h1>${escapeHtml(input.ownerName)}</h1>
            <p>${escapeHtml(input.ownerTitle)} · ${escapeHtml(input.intro)}</p>
          </div>
          <div class="viewer-meta">
            <div><strong>接收方</strong><span>${escapeHtml(company)} / ${escapeHtml(recruiter)}</span></div>
            <div><strong>岗位</strong><span>${escapeHtml(role)}</span></div>
            <div><strong>来源</strong><span>${escapeHtml(platform)}</span></div>
          </div>
        </header>

        <section class="viewer-toolbar">
          <span class="tag">专属链接</span>
          ${input.link.note ? `<span class="tag muted">${escapeHtml(input.link.note)}</span>` : ''}
          <div class="actions">
            <a class="button" href="${pdfUrl}" target="_blank" rel="noreferrer">新窗口打开</a>
            ${input.allowDownloadButton ? `<a class="button ghost" href="${downloadUrl}" target="_blank" rel="noreferrer">下载 PDF</a>` : ''}
          </div>
        </section>

        ${
          input.hasResume
            ? `
              <section class="viewer-frame-wrap">
                <div class="watermark">${escapeHtml(watermark)}</div>
                <iframe id="resume-frame" src="${pdfUrl}#view=FitH" title="Resume PDF"></iframe>
              </section>
            `
            : `
              <section class="panel narrow">
                <h2>简历暂未上传</h2>
                <p>请稍后再试。</p>
              </section>
            `
        }
      </section>

      <script>
        (() => {
          const slug = ${JSON.stringify(input.link.slug)};
          const eventUrl = ${JSON.stringify(`/r/${input.link.slug}/event`)};
          const frame = document.getElementById('resume-frame');
          if (!frame) return;

          const resumeLoadedKey = 'resume-loaded:' + slug;
          frame.addEventListener('load', () => {
            if (sessionStorage.getItem(resumeLoadedKey)) return;
            sessionStorage.setItem(resumeLoadedKey, '1');
            const blob = new Blob([JSON.stringify({ type: 'resume_loaded' })], {
              type: 'application/json'
            });
            navigator.sendBeacon(eventUrl, blob);
          });
        })();
      </script>
    `,
  });
}

export function renderLayout(input: {
  title: string;
  body: string;
  pageClass?: string;
}): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow,noarchive" />
    <title>${escapeHtml(input.title)}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5efe7;
        --paper: rgba(255, 252, 247, 0.9);
        --paper-strong: #fffdf8;
        --line: rgba(54, 41, 28, 0.12);
        --text: #2d2116;
        --muted: #796550;
        --accent: #9a3412;
        --accent-strong: #7c2d12;
        --accent-soft: rgba(154, 52, 18, 0.1);
        --ok: #0f766e;
        --warn: #b45309;
        --danger: #b42318;
        --shadow: 0 18px 50px rgba(70, 40, 15, 0.12);
        --radius: 22px;
      }

      * { box-sizing: border-box; }
      html, body { min-height: 100%; }

      body {
        margin: 0;
        font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(255, 210, 170, 0.35), transparent 30%),
          radial-gradient(circle at bottom right, rgba(171, 116, 63, 0.18), transparent 35%),
          linear-gradient(180deg, #fbf4ea 0%, #f4ede5 100%);
      }

      a { color: inherit; text-decoration: none; }
      button, input, textarea { font: inherit; }

      input, textarea {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.9);
        color: var(--text);
        padding: 0.9rem 1rem;
      }

      input[readonly], textarea[readonly] { background: #f9f5ef; }

      button, .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        border: 0;
        border-radius: 999px;
        background: linear-gradient(135deg, var(--accent), var(--accent-strong));
        color: #fff;
        cursor: pointer;
        padding: 0.85rem 1.2rem;
        font-weight: 600;
        box-shadow: 0 8px 20px rgba(154, 52, 18, 0.22);
      }

      .button.ghost {
        background: transparent;
        color: var(--text);
        border: 1px solid var(--line);
        box-shadow: none;
      }

      .button.danger { background: var(--danger); }

      main {
        width: min(1200px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 24px 0 48px;
      }

      body.centered main {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .panel {
        background: var(--paper);
        backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.5);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        padding: 24px;
      }

      .panel.narrow { width: min(520px, 100%); }
      .hero, .viewer-shell, .admin-shell { display: grid; gap: 18px; }
      .hero { text-align: center; padding: 42px; }

      .hero h1, .admin-header h1, .viewer-header h1 {
        margin: 0;
        font-size: clamp(2rem, 3.8vw, 3.8rem);
        line-height: 1;
      }

      .hero p, .viewer-header p, .admin-header p, .panel p {
        margin: 0;
        color: var(--muted);
        line-height: 1.7;
      }

      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 0.74rem;
        color: var(--accent);
        font-weight: 700;
      }

      .stack { display: grid; gap: 14px; }
      label { display: grid; gap: 8px; }
      label span { font-size: 0.92rem; color: var(--muted); }

      .error, .warning, .notice {
        padding: 0.85rem 1rem;
        border-radius: 16px;
      }

      .error { background: rgba(180, 35, 24, 0.1); color: var(--danger); }
      .warning { background: rgba(180, 83, 9, 0.1); color: var(--warn); }
      .notice { background: rgba(15, 118, 110, 0.12); color: var(--ok); }

      .admin-header, .viewer-header, .viewer-toolbar, .section-title {
        display: flex;
        gap: 16px;
        align-items: flex-start;
        justify-content: space-between;
      }

      .grid.two {
        display: grid;
        gap: 18px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .stat-grid {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .stat {
        padding: 14px;
        border-radius: 18px;
        background: var(--paper-strong);
        border: 1px solid var(--line);
        display: grid;
        gap: 6px;
      }

      .stat span, .mini-hint, .subtle { color: var(--muted); font-size: 0.88rem; }
      .stat strong { font-size: 1rem; }
      .copy-row { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: start; }
      .copy-row.compact { grid-template-columns: 1fr auto; }
      .table-wrap { overflow-x: auto; }
      table { width: 100%; border-collapse: collapse; min-width: 900px; }
      th, td { text-align: left; padding: 14px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
      th { color: var(--muted); font-size: 0.86rem; font-weight: 600; }
      .row-actions { display: flex; gap: 8px; flex-wrap: wrap; }

      .status {
        display: inline-flex;
        padding: 0.35rem 0.7rem;
        border-radius: 999px;
        font-size: 0.84rem;
        font-weight: 700;
      }

      .status.ok { color: var(--ok); background: rgba(15, 118, 110, 0.12); }
      .status.warn { color: var(--warn); background: rgba(180, 83, 9, 0.12); }
      .empty { text-align: center; color: var(--muted); padding: 28px 14px; }

      .tag {
        display: inline-flex;
        align-items: center;
        padding: 0.4rem 0.75rem;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 0.84rem;
        font-weight: 700;
      }

      .tag.muted { background: rgba(121, 101, 80, 0.12); color: var(--muted); }
      .viewer-page main { width: min(1320px, calc(100vw - 24px)); padding-top: 16px; }
      .viewer-meta { display: grid; gap: 12px; min-width: min(100%, 320px); }

      .viewer-meta div {
        display: grid;
        gap: 4px;
        padding: 12px 14px;
        background: rgba(255, 255, 255, 0.72);
        border: 1px solid var(--line);
        border-radius: 16px;
      }

      .viewer-meta strong { font-size: 0.82rem; color: var(--muted); }

      .viewer-frame-wrap {
        position: relative;
        min-height: 72vh;
        background: rgba(255, 255, 255, 0.7);
        border-radius: 24px;
        overflow: hidden;
        border: 1px solid var(--line);
        box-shadow: var(--shadow);
      }

      .viewer-frame-wrap iframe {
        width: 100%;
        min-height: 72vh;
        border: 0;
        display: block;
        background: #cfc6ba;
      }

      .watermark {
        position: absolute;
        inset: auto 16px 16px auto;
        z-index: 2;
        pointer-events: none;
        color: rgba(45, 33, 22, 0.5);
        font-size: 0.82rem;
        background: rgba(255, 252, 247, 0.78);
        padding: 0.45rem 0.75rem;
        border-radius: 999px;
        border: 1px solid rgba(45, 33, 22, 0.08);
        backdrop-filter: blur(8px);
      }

      @media (max-width: 900px) {
        main, .viewer-page main { width: min(100vw - 20px, 100%); }
        .grid.two, .stat-grid { grid-template-columns: 1fr; }
        .admin-header, .viewer-header, .viewer-toolbar, .section-title, .copy-row {
          grid-template-columns: 1fr;
          display: grid;
        }
        .viewer-frame-wrap, .viewer-frame-wrap iframe { min-height: 62vh; }
      }
    </style>
  </head>
  <body class="${escapeHtml(input.pageClass || '')}">
    <main>
      ${input.body}
    </main>
  </body>
</html>`;
}

export function renderAdminDashboardPage(input: {
  origin: string;
  links: ShareLink[];
  events: ViewEvent[];
  createdSlug: string | null;
  shareUrl: string;
  suggestedText: string;
  activeResumeKey: string;
  activeResumeName: string;
  activeResumeSize: string;
  activeResumeUploadedAt: string;
  allowDownloadButton: boolean;
  defaultExpireDays: number;
  message: string | null;
}): string {
  const defaultExpiryValue = toDateTimeLocalInput(addDays(new Date(), input.defaultExpireDays));
  const uploadState = input.activeResumeKey
    ? `
      <div class="stat-grid">
        <div class="stat">
          <span>当前简历</span>
          <strong>${escapeHtml(input.activeResumeName || input.activeResumeKey)}</strong>
        </div>
        <div class="stat">
          <span>大小</span>
          <strong>${formatFileSize(Number(input.activeResumeSize || '0'))}</strong>
        </div>
        <div class="stat">
          <span>上传时间</span>
          <strong>${formatDateTime(input.activeResumeUploadedAt)}</strong>
        </div>
      </div>
    `
    : '<p class="warning">还没有上传 PDF。招聘方打开链接时会看到“简历暂未上传”。</p>';

  return renderLayout({
    title: 'Resume Admin',
    pageClass: 'admin-page',
    body: `
      <section class="admin-shell">
        <header class="admin-header">
          <div>
            <div class="eyebrow">Cloudflare Worker Admin</div>
            <h1>简历私链后台</h1>
            <p>管理 PDF、生成招聘专属链接、查看访问记录。</p>
          </div>
          <form method="post" action="/admin/logout">
            <button type="submit" class="button ghost">退出登录</button>
          </form>
        </header>

        ${input.message ? `<p class="notice">${escapeHtml(input.message)}</p>` : ''}

        <section class="grid two">
          <article class="panel">
            <div class="section-title">
              <div>
                <div class="eyebrow">Resume PDF</div>
                <h2>上传当前简历</h2>
              </div>
            </div>
            ${uploadState}
            <form method="post" action="/admin/upload-resume" enctype="multipart/form-data" class="stack">
              <label>
                <span>PDF 文件</span>
                <input type="file" name="resume" accept="application/pdf,.pdf" required />
              </label>
              <button type="submit">上传并替换当前简历</button>
            </form>
          </article>

          <article class="panel">
            <div class="section-title">
              <div>
                <div class="eyebrow">Share Link</div>
                <h2>创建招聘专属链接</h2>
              </div>
            </div>
            <form method="post" action="/admin/create-link" class="stack">
              <label>
                <span>公司</span>
                <input type="text" name="company_name" maxlength="120" placeholder="例如：某某科技" required />
              </label>
              <label>
                <span>招聘者</span>
                <input type="text" name="recruiter_name" maxlength="80" placeholder="例如：李经理" />
              </label>
              <label>
                <span>岗位</span>
                <input type="text" name="role_title" maxlength="120" placeholder="例如：前端工程师" />
              </label>
              <label>
                <span>平台</span>
                <input type="text" name="platform_name" maxlength="80" placeholder="例如：BOSS直聘" />
              </label>
              <label>
                <span>备注</span>
                <textarea name="note" maxlength="240" rows="3" placeholder="例如：主动打招呼时发送"></textarea>
              </label>
              <label>
                <span>过期时间</span>
                <input type="datetime-local" name="expires_at" value="${escapeHtml(defaultExpiryValue)}" />
              </label>
              <button type="submit">生成专属链接</button>
            </form>
          </article>
        </section>

        ${
          input.createdSlug
            ? `
              <section class="panel">
                <div class="section-title">
                  <div>
                    <div class="eyebrow">Created</div>
                    <h2>新链接已生成</h2>
                  </div>
                </div>
                <label class="stack">
                  <span>分享链接</span>
                  <div class="copy-row">
                    <input type="text" value="${escapeHtml(input.shareUrl)}" readonly />
                    <button type="button" class="button ghost copy-trigger" data-copy="${escapeHtml(input.shareUrl)}">复制</button>
                  </div>
                </label>
                <label class="stack">
                  <span>建议打招呼文案</span>
                  <div class="copy-row">
                    <textarea rows="3" readonly>${escapeHtml(input.suggestedText)}</textarea>
                    <button type="button" class="button ghost copy-trigger" data-copy="${escapeHtml(input.suggestedText)}">复制</button>
                  </div>
                </label>
              </section>
            `
            : ''
        }

        <section class="panel">
          <div class="section-title">
            <div>
              <div class="eyebrow">Links</div>
              <h2>已创建链接</h2>
            </div>
            <span class="mini-hint">下载按钮：${input.allowDownloadButton ? '已开启' : '已关闭'}</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>对象</th>
                  <th>链接</th>
                  <th>状态</th>
                  <th>打开页数</th>
                  <th>确认看过</th>
                  <th>下载</th>
                  <th>最近活动</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                ${
                  input.links.length
                    ? input.links.map((link) => renderLinkRow(link, input.origin)).join('')
                    : '<tr><td colspan="8" class="empty">还没有任何分享链接。</td></tr>'
                }
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel">
          <div class="section-title">
            <div>
              <div class="eyebrow">Events</div>
              <h2>最近访问记录</h2>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>对象</th>
                  <th>事件</th>
                  <th>位置</th>
                  <th>访客标识</th>
                  <th>设备</th>
                </tr>
              </thead>
              <tbody>
                ${
                  input.events.length
                    ? input.events.map((event) => renderEventRow(event)).join('')
                    : '<tr><td colspan="6" class="empty">暂无访问记录。</td></tr>'
                }
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <script>
        document.querySelectorAll('.copy-trigger').forEach((button) => {
          button.addEventListener('click', async () => {
            const text = button.getAttribute('data-copy') || '';
            try {
              await navigator.clipboard.writeText(text);
              button.textContent = '已复制';
              setTimeout(() => {
                button.textContent = '复制';
              }, 1500);
            } catch {
              button.textContent = '复制失败';
            }
          });
        });
      </script>
    `,
  });
}

function renderLinkRow(link: ShareLink, origin: string): string {
  const target = [link.company_name, link.recruiter_name].filter(Boolean).join(' / ') || '未命名对象';
  const shareUrl = `${origin}/r/${link.slug}`;
  const status = getLinkAvailability(link);

  return `
    <tr>
      <td>
        <strong>${escapeHtml(target)}</strong>
        <div class="subtle">${escapeHtml(link.role_title || '未填写岗位')}</div>
      </td>
      <td>
        <div class="copy-row compact">
          <input type="text" value="${escapeHtml(shareUrl)}" readonly />
          <button type="button" class="button ghost copy-trigger" data-copy="${escapeHtml(shareUrl)}">复制</button>
        </div>
      </td>
      <td>
        <span class="status ${status.active ? 'ok' : 'warn'}">${escapeHtml(status.label)}</span>
        ${link.expires_at ? `<div class="subtle">到期：${escapeHtml(formatDateTime(link.expires_at))}</div>` : ''}
      </td>
      <td>${link.page_open_count}</td>
      <td>${link.resume_view_count}</td>
      <td>${link.download_count}</td>
      <td>${escapeHtml(formatDateTime(link.last_event_at || link.created_at))}</td>
      <td class="row-actions">
        <a class="button ghost" href="${escapeHtml(shareUrl)}" target="_blank" rel="noreferrer">打开</a>
        ${
          status.active
            ? `
              <form method="post" action="/admin/links/${encodeURIComponent(link.slug)}/revoke">
                <button type="submit" class="button danger">停用</button>
              </form>
            `
            : ''
        }
      </td>
    </tr>
  `;
}

function renderEventRow(event: ViewEvent): string {
  const target = [event.company_name, event.recruiter_name].filter(Boolean).join(' / ') || event.slug;
  const location = [event.country, event.city, event.colo].filter(Boolean).join(' · ') || '未知';
  const viewer = event.viewer_id ? event.viewer_id.slice(0, 12) : '无';
  const device = summarizeUserAgent(event.user_agent);
  return `
    <tr>
      <td>${escapeHtml(formatDateTime(event.occurred_at))}</td>
      <td>
        <strong>${escapeHtml(target)}</strong>
        <div class="subtle">${escapeHtml(event.role_title || '未填写岗位')}</div>
      </td>
      <td>${escapeHtml(renderEventLabel(event.event_type))}</td>
      <td>${escapeHtml(location)}</td>
      <td>${escapeHtml(viewer)}</td>
      <td>${escapeHtml(device)}</td>
    </tr>
  `;
}

function renderEventLabel(eventType: string): string {
  switch (eventType) {
    case 'page_open':
      return '打开页面';
    case 'resume_loaded':
      return 'PDF 已加载';
    case 'download':
      return '下载 PDF';
    default:
      return eventType;
  }
}

function summarizeUserAgent(userAgent: string | null): string {
  if (!userAgent) {
    return '未知';
  }

  const normalized = userAgent.toLowerCase();
  const browser = normalized.includes('edg/')
    ? 'Edge'
    : normalized.includes('chrome/')
      ? 'Chrome'
      : normalized.includes('safari/')
        ? 'Safari'
        : normalized.includes('firefox/')
          ? 'Firefox'
          : 'Browser';
  const device = normalized.includes('mobile') ? 'Mobile' : 'Desktop';
  return `${browser} / ${device}`;
}
