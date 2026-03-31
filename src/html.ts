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
      <section class="panel hero-card reveal">
        <div class="eyebrow">Private Resume Delivery</div>
        <h1>把简历链接做得更专业，也更可追踪。</h1>
        <p>${escapeHtml(input.intro)}</p>
        <div class="hero-caption">由 ${escapeHtml(input.ownerName)} 维护的专属简历入口</div>
        <div class="hero-actions">
          <a class="button button-primary" href="/admin/login">进入后台</a>
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
      <section class="panel auth-card reveal">
        <div class="eyebrow">Admin Access</div>
        <h1>登录后台</h1>
        <p>使用部署到 Worker 的管理员密码进入控制台。</p>
        ${message ? `<p class="message-banner is-danger">${escapeHtml(message)}</p>` : ''}
        <form method="post" action="/admin/login" class="stack">
          <label>
            <span>管理员密码</span>
            <input type="password" name="password" autocomplete="current-password" required />
          </label>
          <button type="submit" class="button button-primary full">进入后台</button>
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
      <section class="panel auth-card reveal">
        <div class="eyebrow">Access Closed</div>
        <h1>这个简历链接当前不可用</h1>
        <p>${escapeHtml(reason)}</p>
      </section>
    `,
  });
}

export function renderPublicResumePage(input: {
  link: ShareLink;
  ownerName: string;
  hasResume: boolean;
  allowDownloadButton: boolean;
}): string {
  const pdfUrl = `/r/${encodeURIComponent(input.link.slug)}/pdf`;
  const downloadUrl = `${pdfUrl}?download=1`;
  const viewerSrc = `${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH&zoom=page-width`;

  return renderLayout({
    title: `${input.ownerName} Resume`,
    pageClass: 'viewer-page',
    body: `
      <section class="viewer-minimal">
        <div class="viewer-download-rail">
          <div class="viewer-download-copy">
            <div class="eyebrow">Private Resume PDF</div>
          </div>
          ${
            input.allowDownloadButton
              ? `<a class="button button-primary button-xl download-callout" href="${downloadUrl}" rel="noreferrer">下载 PDF</a>`
              : `<span class="tag">下载按钮已关闭</span>`
          }
        </div>

        ${
          input.hasResume
            ? `
              <section class="viewer-stage">
                <iframe id="resume-frame" src="${viewerSrc}" title="Resume PDF"></iframe>
              </section>
            `
            : `
              <section class="panel narrow viewer-empty">
                <div class="eyebrow">Resume Pending</div>
                <h1>简历暂未上传</h1>
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
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700;800&family=Noto+Serif+SC:wght@600;700;900&display=swap" rel="stylesheet" />
    <style>
      :root{color-scheme:light;--bg:#f4eee4;--bg-deep:#eadfcd;--surface:rgba(255,251,246,.82);--line:rgba(13,24,42,.1);--line-strong:rgba(13,24,42,.16);--text:#111827;--muted:#5b6474;--brand:#102542;--brand-2:#183659;--accent:#b77934;--success:#0f766e;--danger:#b42318;--shadow:0 22px 70px rgba(17,24,39,.12);--soft:0 10px 30px rgba(17,24,39,.08)}
      *{box-sizing:border-box}html,body{min-height:100%}
      body{margin:0;color:var(--text);font-family:'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif;background:radial-gradient(circle at top left,rgba(255,243,220,.9),transparent 28%),radial-gradient(circle at bottom right,rgba(16,37,66,.12),transparent 34%),linear-gradient(180deg,#f8f3ea 0%,var(--bg) 54%,var(--bg-deep) 100%)}
      body::before{content:'';position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(16,37,66,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(16,37,66,.04) 1px,transparent 1px);background-size:40px 40px;mask-image:radial-gradient(circle at center,black 32%,transparent 95%);opacity:.4}
      body.viewer-page{overflow:hidden}
      a{color:inherit;text-decoration:none}
      button,input,textarea{font:inherit}
      h1,h2,h3{margin:0;font-family:'Noto Serif SC','Songti SC',serif;letter-spacing:-.02em}
      p{margin:0;color:var(--muted);line-height:1.75}
      main{width:min(1380px,calc(100vw - 40px));margin:0 auto;padding:30px 0 52px;position:relative;z-index:1}
      body.centered main{min-height:100vh;display:grid;place-items:center}
      body.viewer-page main{width:min(100vw,100%);padding:0}
      input,textarea{width:100%;border:1px solid var(--line-strong);border-radius:18px;background:rgba(255,255,255,.82);color:var(--text);padding:.95rem 1rem;box-shadow:inset 0 1px 0 rgba(255,255,255,.9);transition:border-color .18s ease,box-shadow .18s ease,background .18s ease}
      input:focus,textarea:focus{outline:none;border-color:rgba(16,37,66,.42);box-shadow:0 0 0 4px rgba(16,37,66,.08);background:rgba(255,255,255,.96)}
      input[readonly],textarea[readonly]{background:rgba(247,244,239,.96)}
      textarea{min-height:120px;resize:vertical}
      label{display:grid;gap:10px}label span{color:var(--muted);font-size:.92rem}
      .button{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;min-height:48px;padding:.85rem 1.2rem;border:1px solid transparent;border-radius:999px;font-weight:700;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease,background .18s ease}.button:hover{transform:translateY(-1px)}.button:focus-visible{outline:none;box-shadow:0 0 0 4px rgba(16,37,66,.12)}
      .button-primary{color:#fff;background:linear-gradient(135deg,var(--brand),var(--brand-2));box-shadow:0 18px 36px rgba(16,37,66,.22)}
      .button-secondary{color:var(--text);background:rgba(255,255,255,.82);border-color:var(--line-strong);box-shadow:var(--soft)}
      .button-danger{color:var(--danger);background:rgba(255,245,244,.92);border-color:rgba(180,35,24,.18)}
      .button-xl{min-width:220px;min-height:62px;padding:1rem 1.6rem;font-size:1.05rem}.full{width:100%}
      .panel{position:relative;overflow:hidden;background:var(--surface);border:1px solid rgba(255,255,255,.72);border-radius:32px;backdrop-filter:blur(18px);box-shadow:var(--shadow);padding:28px;transition:transform .22s ease,box-shadow .22s ease}
      .panel::after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(135deg,rgba(255,255,255,.22),transparent 38%)}
      .panel:hover{transform:translateY(-1px);box-shadow:0 26px 78px rgba(17,24,39,.14)}
      .panel.narrow{width:min(620px,100%)}
      .stack,.dashboard-shell,.detail-shell,.hero-card,.auth-card,.dashboard-hero,.detail-hero,.section-card,.result-card,.resume-summary,.viewer-download-copy{display:grid;gap:18px}
      .eyebrow{display:inline-flex;align-items:center;gap:.5rem;color:var(--accent);font-size:.78rem;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
      .tag,.status-pill{display:inline-flex;align-items:center;justify-content:center;gap:.35rem;min-height:34px;padding:.45rem .8rem;border-radius:999px;font-size:.84rem;font-weight:700}
      .tag{color:var(--brand);background:rgba(255,255,255,.8);border:1px solid var(--line)}
      .status-pill.is-active{color:var(--success);background:rgba(15,118,110,.12)}.status-pill.is-inactive{color:var(--danger);background:rgba(180,35,24,.12)}
      .message-banner{position:relative;z-index:1;padding:.95rem 1.1rem;border-radius:18px;background:rgba(16,37,66,.08);color:var(--brand);border:1px solid rgba(16,37,66,.08)}.message-banner.is-danger{background:rgba(180,35,24,.12);color:var(--danger)}.message-banner.is-warning{background:rgba(183,121,52,.12);color:#8a5718}
      .hero-card{text-align:center;padding:56px 44px}.hero-card h1,.auth-card h1,.dashboard-hero h1,.detail-hero h1{font-size:clamp(2.2rem,4vw,4.4rem);line-height:1.04}.hero-caption,.subtle,.helper{color:var(--muted);font-size:.88rem}
      .hero-actions,.row-actions{display:flex;flex-wrap:wrap;gap:10px}.hero-actions{justify-content:center}
      .dashboard-topbar,.detail-topbar,.section-head,.result-head,.viewer-download-rail,.copy-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
      .dashboard-copy,.detail-copy{display:grid;gap:14px;max-width:820px}.dashboard-copy p,.detail-copy p{max-width:760px}
      .mini-stat-grid,.section-grid,.field-grid,.resume-meta-grid,.detail-meta-grid{display:grid;gap:14px}
      .mini-stat-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.section-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}.field-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.field-grid .full-span{grid-column:1 / -1}.resume-meta-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.detail-meta-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
      .mini-stat,.resume-meta-card,.metric-row,.resume-name-card{position:relative;z-index:1;border-radius:22px;border:1px solid var(--line)}.mini-stat,.resume-meta-card{padding:16px 18px;background:rgba(255,255,255,.82)}.mini-stat span,.resume-meta-card span{color:var(--muted);font-size:.88rem}.mini-stat strong,.resume-meta-card strong{display:block;margin-top:8px;font-size:1.06rem;line-height:1.45;overflow-wrap:anywhere}
      .resume-name-card{padding:18px 20px;background:linear-gradient(135deg,rgba(16,37,66,.08),rgba(255,255,255,.72))}.resume-name-card strong{display:block;margin-top:8px;font-size:1.06rem;line-height:1.5;word-break:break-all}
      .upload-field{position:relative;display:block}.upload-input{position:absolute;inset:0;opacity:0;cursor:pointer;z-index:2}.upload-surface{position:relative;z-index:1;display:grid;gap:10px;padding:24px;border:1px dashed rgba(16,37,66,.18);border-radius:26px;background:linear-gradient(135deg,rgba(16,37,66,.05),rgba(255,255,255,.6)),rgba(255,255,255,.68);box-shadow:inset 0 1px 0 rgba(255,255,255,.75);transition:border-color .18s ease,transform .18s ease,box-shadow .18s ease}.upload-field:hover .upload-surface,.upload-field:focus-within .upload-surface{border-color:rgba(16,37,66,.34);transform:translateY(-1px);box-shadow:0 18px 32px rgba(16,37,66,.08),inset 0 1px 0 rgba(255,255,255,.75)}.upload-kicker{color:var(--accent);font-size:.78rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.upload-title{color:var(--text);font-size:1.1rem;font-weight:800;line-height:1.45;word-break:break-all}.upload-helper{color:var(--muted);font-size:.9rem}.upload-chip{display:inline-flex;align-items:center;justify-content:center;width:fit-content;padding:.65rem .95rem;border-radius:999px;background:rgba(16,37,66,.08);color:var(--brand);font-weight:700}
      .copy-stack,.metric-cluster{display:grid;gap:14px}.copy-row{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:start}.copy-row textarea{min-height:110px}
      .table-wrap{overflow-x:auto;position:relative;z-index:1}table{width:100%;min-width:1240px;border-collapse:collapse}th,td{padding:16px 12px;border-bottom:1px solid rgba(16,37,66,.08);text-align:left;vertical-align:top}thead th{position:sticky;top:0;background:rgba(248,243,234,.94);backdrop-filter:blur(12px);z-index:1}tbody tr{transition:background .18s ease}tbody tr:hover{background:rgba(255,255,255,.46)}th{color:var(--muted);font-size:.82rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase}td strong{display:block;line-height:1.5}.table-input{width:260px;padding:.72rem .85rem;font-size:.9rem}.metric-cluster{min-width:168px}.metric-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 12px;background:rgba(255,255,255,.76)}.metric-row span{color:var(--muted);font-size:.84rem}.metric-row strong{margin:0;font-size:.98rem}.empty-state{text-align:center;color:var(--muted);padding:28px 16px}
      .viewer-minimal{height:100dvh;display:grid;grid-template-rows:auto 1fr}.viewer-download-rail{position:sticky;top:0;z-index:3;padding:16px 24px;background:rgba(10,20,36,.92);color:#f7f3eb;border-bottom:1px solid rgba(255,255,255,.08);backdrop-filter:blur(18px)}.viewer-download-copy .eyebrow{color:rgba(255,222,186,.82)}.viewer-download-copy p{color:rgba(247,243,235,.82);font-size:.94rem}.download-callout{flex-shrink:0;background:linear-gradient(135deg,#d29b48,#b77934);box-shadow:0 18px 36px rgba(210,155,72,.22)}.viewer-stage{position:relative;height:calc(100dvh - 86px);background:radial-gradient(circle at top right,rgba(16,37,66,.08),transparent 28%),linear-gradient(180deg,#efe7da 0%,#dfd3c0 100%)}.viewer-stage iframe{width:100%;height:100%;border:0;display:block;background:#d9d0c2}.viewer-empty{align-self:center;justify-self:center}
      .reveal{animation:rise .42s ease both}@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      @media (max-width:1100px){.section-grid,.mini-stat-grid,.detail-meta-grid,.field-grid,.resume-meta-grid{grid-template-columns:1fr}}
      @media (max-width:860px){main{width:min(100vw - 20px,100%);padding:20px 0 36px}.panel{padding:22px;border-radius:24px}.dashboard-topbar,.detail-topbar,.section-head,.result-head,.viewer-download-rail,.copy-row{display:grid;grid-template-columns:1fr}.button-xl,.download-callout{width:100%}.viewer-download-rail{padding:16px 18px 14px}.viewer-stage{height:calc(100dvh - 138px)}}
      @media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
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
  const activeLinkCount = input.links.filter((link) => getLinkAvailability(link).active).length;
  const totalDownloads = input.links.reduce((sum, link) => sum + link.download_count, 0);

  return renderLayout({
    title: 'Resume Admin',
    pageClass: 'admin-page',
    body: `
      <section class="dashboard-shell">
        <header class="panel dashboard-hero reveal">
          <div class="dashboard-topbar">
            <div class="dashboard-copy">
              <div class="eyebrow">Resume Control Room</div>
              <h1>简历私链后台</h1>
              <p>上传当前 PDF，生成更体面的专属链接，并按单条链接查看访问行为。</p>
            </div>
            <form method="post" action="/admin/logout">
              <button type="submit" class="button button-secondary">退出登录</button>
            </form>
          </div>

          <div class="mini-stat-grid">
            <div class="mini-stat">
              <span>已创建链接</span>
              <strong>${input.links.length}</strong>
            </div>
            <div class="mini-stat">
              <span>当前有效</span>
              <strong>${activeLinkCount}</strong>
            </div>
            <div class="mini-stat">
              <span>累计下载</span>
              <strong>${totalDownloads}</strong>
            </div>
          </div>
        </header>

        ${input.message ? `<p class="message-banner">${escapeHtml(input.message)}</p>` : ''}

        ${
          input.createdSlug
            ? `
              <section class="panel result-card reveal">
                <div class="result-head">
                  <div>
                    <div class="eyebrow">Share Link Ready</div>
                    <h2>新链接已生成</h2>
                  </div>
                  <span class="tag">复制后即可发送</span>
                </div>

                <div class="copy-stack">
                  <label>
                    <span>分享链接</span>
                    <div class="copy-row">
                      <input type="text" value="${escapeHtml(input.shareUrl)}" readonly />
                      <button type="button" class="button button-secondary copy-trigger" data-copy="${escapeHtml(input.shareUrl)}" data-label="复制链接">复制链接</button>
                    </div>
                  </label>
                  <label>
                    <span>建议打招呼文案</span>
                    <div class="copy-row">
                      <textarea rows="3" readonly>${escapeHtml(input.suggestedText)}</textarea>
                      <button type="button" class="button button-secondary copy-trigger" data-copy="${escapeHtml(input.suggestedText)}" data-label="复制文案">复制文案</button>
                    </div>
                  </label>
                </div>
              </section>
            `
            : ''
        }

        <section class="section-grid">
          <article class="panel section-card reveal">
            <div class="section-head">
              <div>
                <div class="eyebrow">Resume Asset</div>
                <h2>上传当前简历</h2>
              </div>
              <span class="tag">PDF / 10MB 内</span>
            </div>

            ${renderResumeAssetSummary({
              activeResumeKey: input.activeResumeKey,
              activeResumeName: input.activeResumeName,
              activeResumeSize: input.activeResumeSize,
              activeResumeUploadedAt: input.activeResumeUploadedAt,
            })}

            <form method="post" action="/admin/upload-resume" enctype="multipart/form-data" class="stack">
              <label class="upload-field">
                <input class="upload-input" type="file" name="resume" accept="application/pdf,.pdf" required data-resume-input />
                <span class="upload-surface">
                  <span class="upload-kicker">Choose Resume PDF</span>
                  <strong class="upload-title" data-selected-file>点击选择简历 PDF</strong>
                  <span class="upload-helper">支持中文文件名，后台展示和下载文件名都会保留完整名称。</span>
                  <span class="upload-chip">选择文件</span>
                </span>
              </label>
              <button type="submit" class="button button-primary">上传并替换当前简历</button>
            </form>
          </article>

          <article class="panel section-card reveal">
            <div class="section-head">
              <div>
                <div class="eyebrow">Share Link</div>
                <h2>创建招聘专属链接</h2>
              </div>
              <span class="tag">下载按钮：${input.allowDownloadButton ? '已开启' : '已关闭'}</span>
            </div>
            <form method="post" action="/admin/create-link" class="stack">
              <div class="field-grid">
                <label>
                  <span>公司</span>
                  <input type="text" name="company_name" maxlength="120" placeholder="例如：某某科技" required />
                </label>
                <label>
                  <span>平台</span>
                  <input type="text" name="platform_name" maxlength="80" placeholder="例如：BOSS直聘" />
                </label>
                <label>
                  <span>招聘者</span>
                  <input type="text" name="recruiter_name" maxlength="80" placeholder="例如：李经理" />
                </label>
                <label>
                  <span>岗位</span>
                  <input type="text" name="role_title" maxlength="120" placeholder="例如：前端工程师" />
                </label>
                <label class="full-span">
                  <span>备注</span>
                  <textarea name="note" maxlength="240" rows="3" placeholder="例如：主动打招呼时发送"></textarea>
                </label>
                <label class="full-span">
                  <span>过期时间</span>
                  <input type="datetime-local" name="expires_at" value="${escapeHtml(defaultExpiryValue)}" />
                </label>
              </div>
              <button type="submit" class="button button-primary">生成专属链接</button>
            </form>
          </article>
        </section>

        <section class="panel reveal">
          <div class="section-head">
            <div>
              <div class="eyebrow">Link Ledger</div>
              <h2>已创建链接</h2>
            </div>
            <span class="helper">公司 / 平台 / 招聘者 / 岗位 / 统计 / 操作</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>公司</th>
                  <th>平台</th>
                  <th>招聘者</th>
                  <th>岗位</th>
                  <th>分享链接</th>
                  <th>状态</th>
                  <th>统计</th>
                  <th>最近活动</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                ${
                  input.links.length
                    ? input.links.map((link) => renderLinkRow(link, input.origin)).join('')
                    : '<tr><td colspan="9" class="empty-state">还没有任何分享链接。</td></tr>'
                }
              </tbody>
            </table>
          </div>
        </section>
      </section>

      ${renderAdminPageScript()}
    `,
  });
}

export function renderAdminLinkEventsPage(input: {
  origin: string;
  link: ShareLink;
  events: ViewEvent[];
}): string {
  const shareUrl = `${input.origin}/r/${input.link.slug}`;
  const status = getLinkAvailability(input.link);
  const targetName = input.link.company_name || '未命名公司';
  const recruiterName = input.link.recruiter_name || '未填写招聘者';
  const platformName = input.link.platform_name || '未填写平台';
  const roleTitle = input.link.role_title || '未填写岗位';

  return renderLayout({
    title: `Link Events · ${targetName}`,
    pageClass: 'admin-page',
    body: `
      <section class="detail-shell">
        <div class="detail-topbar">
          <a class="button button-secondary" href="/admin">返回后台</a>
          <form method="post" action="/admin/logout">
            <button type="submit" class="button button-secondary">退出登录</button>
          </form>
        </div>

        <section class="panel detail-hero reveal">
          <div class="detail-copy">
            <div class="eyebrow">Access Timeline</div>
            <h1>${escapeHtml(targetName)}</h1>
            <p>${escapeHtml(platformName)} · ${escapeHtml(recruiterName)} · ${escapeHtml(roleTitle)}</p>
          </div>

          <div class="detail-meta-grid">
            <div class="resume-meta-card">
              <span>链接状态</span>
              <strong><span class="status-pill ${status.active ? 'is-active' : 'is-inactive'}">${escapeHtml(status.label)}</span></strong>
            </div>
            <div class="resume-meta-card">
              <span>页面打开</span>
              <strong>${input.link.page_open_count}</strong>
            </div>
            <div class="resume-meta-card">
              <span>PDF 已加载</span>
              <strong>${input.link.resume_view_count}</strong>
            </div>
            <div class="resume-meta-card">
              <span>下载次数</span>
              <strong>${input.link.download_count}</strong>
            </div>
          </div>

          <label>
            <span>分享链接</span>
            <div class="copy-row">
              <input type="text" value="${escapeHtml(shareUrl)}" readonly />
              <button type="button" class="button button-secondary copy-trigger" data-copy="${escapeHtml(shareUrl)}" data-label="复制链接">复制链接</button>
            </div>
          </label>
        </section>

        <section class="panel reveal">
          <div class="section-head">
            <div>
              <div class="eyebrow">Event Feed</div>
              <h2>访问记录</h2>
            </div>
            <span class="helper">最多展示最近 200 条事件，包含访问 IP 与访客 Cookie 标识</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>事件</th>
                  <th>IP</th>
                  <th>位置</th>
                  <th>访客标识</th>
                  <th>设备</th>
                  <th>来源</th>
                </tr>
              </thead>
              <tbody>
                ${
                  input.events.length
                    ? input.events.map((event) => renderEventRow(event)).join('')
                    : '<tr><td colspan="7" class="empty-state">这个链接还没有访问记录。</td></tr>'
                }
              </tbody>
            </table>
          </div>
        </section>
      </section>

      ${renderCopyScript()}
    `,
  });
}

function renderResumeAssetSummary(input: {
  activeResumeKey: string;
  activeResumeName: string;
  activeResumeSize: string;
  activeResumeUploadedAt: string;
}): string {
  if (!input.activeResumeKey) {
    return '<p class="message-banner is-warning">还没有上传 PDF。招聘方打开链接时会看到“简历暂未上传”。</p>';
  }

  return `
    <div class="resume-summary">
      <div class="resume-name-card">
        <span>当前文件名</span>
        <strong>${escapeHtml(input.activeResumeName || input.activeResumeKey)}</strong>
      </div>
      <div class="resume-meta-grid">
        <div class="resume-meta-card">
          <span>文件大小</span>
          <strong>${formatFileSize(Number(input.activeResumeSize || '0'))}</strong>
        </div>
        <div class="resume-meta-card">
          <span>上传时间</span>
          <strong>${escapeHtml(formatDateTime(input.activeResumeUploadedAt))}</strong>
        </div>
      </div>
    </div>
  `;
}

function renderLinkRow(link: ShareLink, origin: string): string {
  const shareUrl = `${origin}/r/${link.slug}`;
  const status = getLinkAvailability(link);

  return `
    <tr>
      <td><strong>${escapeHtml(link.company_name || '未填写公司')}</strong></td>
      <td><strong>${escapeHtml(link.platform_name || '未填写平台')}</strong></td>
      <td>
        <strong>${escapeHtml(link.recruiter_name || '未填写招聘者')}</strong>
        ${link.note ? `<div class="subtle">${escapeHtml(link.note)}</div>` : ''}
      </td>
      <td><strong>${escapeHtml(link.role_title || '未填写岗位')}</strong></td>
      <td>
        <div class="copy-row">
          <input class="table-input" type="text" value="${escapeHtml(shareUrl)}" readonly />
          <button type="button" class="button button-secondary copy-trigger" data-copy="${escapeHtml(shareUrl)}" data-label="复制">复制</button>
        </div>
      </td>
      <td>
        <span class="status-pill ${status.active ? 'is-active' : 'is-inactive'}">${escapeHtml(status.label)}</span>
        ${link.expires_at ? `<div class="subtle">到期：${escapeHtml(formatDateTime(link.expires_at))}</div>` : ''}
      </td>
      <td>
        <div class="metric-cluster">
          <div class="metric-row"><span>页面打开</span><strong>${link.page_open_count}</strong></div>
          <div class="metric-row"><span>PDF 已加载</span><strong>${link.resume_view_count}</strong></div>
          <div class="metric-row"><span>下载</span><strong>${link.download_count}</strong></div>
        </div>
      </td>
      <td>${escapeHtml(formatDateTime(link.last_event_at || link.created_at))}</td>
      <td>
        <div class="row-actions">
          <a class="button button-secondary" href="/admin/links/${encodeURIComponent(link.slug)}/events">访问记录</a>
          <a class="button button-secondary" href="${escapeHtml(shareUrl)}" target="_blank" rel="noreferrer">打开</a>
          ${
            status.active
              ? `
                <form method="post" action="/admin/links/${encodeURIComponent(link.slug)}/revoke">
                  <button type="submit" class="button button-danger">停用</button>
                </form>
              `
              : ''
          }
        </div>
      </td>
    </tr>
  `;
}

function renderEventRow(event: ViewEvent): string {
  const viewer = event.viewer_id ? event.viewer_id.slice(0, 12) : '无';
  const ipAddress = event.ip_address || '未知';

  return `
    <tr>
      <td>${escapeHtml(formatDateTime(event.occurred_at))}</td>
      <td>${escapeHtml(renderEventLabel(event.event_type))}</td>
      <td>${escapeHtml(ipAddress)}</td>
      <td>${escapeHtml(renderLocation(event))}</td>
      <td>${escapeHtml(viewer)}</td>
      <td>${escapeHtml(summarizeUserAgent(event.user_agent))}</td>
      <td>${escapeHtml(summarizeReferer(event.referer))}</td>
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

function renderLocation(event: ViewEvent): string {
  return [event.country, event.city, event.colo].filter(Boolean).join(' · ') || '未知';
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

function summarizeReferer(referer: string | null): string {
  if (!referer) {
    return '直接打开';
  }

  try {
    return new URL(referer).host || referer;
  } catch {
    return referer;
  }
}

function renderAdminPageScript(): string {
  return `
    <script>
      (() => {
        document.querySelectorAll('.copy-trigger').forEach((button) => {
          button.addEventListener('click', async () => {
            const text = button.getAttribute('data-copy') || '';
            const label = button.getAttribute('data-label') || '复制';
            try {
              await navigator.clipboard.writeText(text);
              button.textContent = '已复制';
              setTimeout(() => {
                button.textContent = label;
              }, 1400);
            } catch {
              button.textContent = '复制失败';
              setTimeout(() => {
                button.textContent = label;
              }, 1400);
            }
          });
        });

        const fileInput = document.querySelector('[data-resume-input]');
        const fileName = document.querySelector('[data-selected-file]');
        if (fileInput && fileName) {
          fileInput.addEventListener('change', () => {
            const nextName = fileInput.files && fileInput.files[0]
              ? fileInput.files[0].name
              : '点击选择简历 PDF';
            fileName.textContent = nextName;
          });
        }
      })();
    </script>
  `;
}

function renderCopyScript(): string {
  return `
    <script>
      (() => {
        document.querySelectorAll('.copy-trigger').forEach((button) => {
          button.addEventListener('click', async () => {
            const text = button.getAttribute('data-copy') || '';
            const label = button.getAttribute('data-label') || '复制';
            try {
              await navigator.clipboard.writeText(text);
              button.textContent = '已复制';
              setTimeout(() => {
                button.textContent = label;
              }, 1400);
            } catch {
              button.textContent = '复制失败';
              setTimeout(() => {
                button.textContent = label;
              }, 1400);
            }
          });
        });
      })();
    </script>
  `;
}
