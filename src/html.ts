import { getLinkAvailability } from './db';
import { APP_NAME, ShareLink, ViewEvent } from './types';
import {
  addDays,
  escapeHtml,
  formatDateTime,
  formatFileSize,
  toDateTimeLocalInput,
} from './utils';

const PDFJS_VERSION = '5.6.205';

export function renderAdminLoginPage(message?: string): string {
  return renderLayout({
    title: APP_NAME,
    pageClass: 'centered login-page',
    body: `
      <section class="panel auth-card reveal">
        <div class="eyebrow">${APP_NAME}</div>
        <h1>登录后台</h1>
        <p>上传简历、生成专属链接、查看访问记录，也可以把站点安装到手机或桌面后直接打开。</p>
        ${message ? `<p class="message-banner is-danger">${escapeHtml(message)}</p>` : ''}
        <form method="post" action="/admin/login" class="stack">
          <label>
            <span>管理员密码</span>
            <input type="password" name="password" autocomplete="current-password" required />
          </label>
          <button type="submit" class="button button-primary full">进入后台</button>
        </form>
        <div class="helper-inline">
          <span class="tag">PWA Ready</span>
          <span class="subtle">支持安装到手机和桌面</span>
        </div>
      </section>
    `,
  });
}

export function renderInvalidLinkPage(reason: string): string {
  return renderLayout({
    title: APP_NAME,
    pageClass: 'centered',
    enableInstallUi: false,
    body: `
      <section class="panel auth-card reveal">
        <div class="eyebrow">${APP_NAME}</div>
        <h1>这个简历链接当前不可用</h1>
        <p>${escapeHtml(reason)}</p>
      </section>
    `,
  });
}

export function renderPublicResumePage(input: {
  link: ShareLink;
  hasResume: boolean;
  allowDownloadButton: boolean;
}): string {
  const pdfUrl = `/r/${encodeURIComponent(input.link.slug)}/pdf`;
  const downloadUrl = `${pdfUrl}?download=1`;
  const pdfJsUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`;
  const pdfJsWorkerUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

  return renderLayout({
    title: APP_NAME,
    pageClass: 'viewer-page',
    enableInstallUi: false,
    viewportContent: 'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no',
    body: `
      <section class="viewer-shell">
        ${
          input.allowDownloadButton
            ? `
              <header class="viewer-topbar viewer-topbar-actions-only">
                <div class="viewer-actions">
                  <a class="button button-primary button-xl" href="${downloadUrl}" rel="noreferrer">下载 PDF</a>
                </div>
              </header>
            `
            : ''
        }

        ${
          input.hasResume
            ? `
              <section class="viewer-stage" data-viewer-stage>
                <div class="pdf-scroll-stage" data-pdf-stage>
                  <div class="pdf-stage-shell">
                    <div class="pdf-status reveal" data-pdf-status>正在加载简历预览...</div>

                    <div class="pdf-pages" hidden data-pdf-pages></div>
                  </div>
                </div>
              </section>
            `
            : `
              <section class="viewer-stage viewer-empty-wrap">
                <section class="panel narrow viewer-empty">
                  <div class="eyebrow">Resume Pending</div>
                  <h1>简历暂未上传</h1>
                  <p>请稍后再试。</p>
                </section>
              </section>
            `
        }
      </section>

        <script type="module">
          (() => {
            const slug = ${JSON.stringify(input.link.slug)};
            const eventUrl = ${JSON.stringify(`/r/${input.link.slug}/event`)};
            const pdfUrl = ${JSON.stringify(pdfUrl)};
            const pdfJsUrl = ${JSON.stringify(pdfJsUrl)};
            const pdfJsWorkerUrl = ${JSON.stringify(pdfJsWorkerUrl)};
            const viewerStage = document.querySelector('[data-viewer-stage]');
            const stage = document.querySelector('[data-pdf-stage]');
            const status = document.querySelector('[data-pdf-status]');
            const pages = document.querySelector('[data-pdf-pages]');
            if (!viewerStage || !stage || !status || !pages) return;

            const MIN_ZOOM = 0.75;
            const MAX_ZOOM = 4;
            const RERENDER_IDLE_MS = 140;
            const resumeLoadedKey = 'resume-loaded:' + slug;
            const pageCache = new Map();
            let hasReportedLoad = false;
            let pdfDocument = null;
            let zoomScale = 1;
            let renderedZoomScale = 1;
            let renderedFitScale = 1;
            let renderVersion = 0;
            let currentRenderTask = null;
            let pinchState = null;
            let panState = null;
            let rerenderTimer = 0;
            let resizeTimer = 0;

            const reportResumeLoaded = () => {
              if (hasReportedLoad || sessionStorage.getItem(resumeLoadedKey)) return;
              hasReportedLoad = true;
              sessionStorage.setItem(resumeLoadedKey, '1');
              const blob = new Blob([JSON.stringify({ type: 'resume_loaded' })], {
                type: 'application/json'
              });
              navigator.sendBeacon(eventUrl, blob);
            };

            const updateStatus = (message) => {
              status.textContent = message;
            };

            const showStatus = (message) => {
              updateStatus(message);
              status.hidden = false;
            };

            const clampZoom = (value) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));

            const showError = (message = '简历预览加载失败，请刷新后重试。') => {
              showStatus(message);
              if (!pages.childElementCount) {
                pages.hidden = true;
              }
            };

            const getAvailableWidth = () => {
              const style = window.getComputedStyle(viewerStage);
              const horizontalPadding = Number.parseFloat(style.paddingLeft || '0') + Number.parseFloat(style.paddingRight || '0');
              return Math.max(280, Math.min(viewerStage.clientWidth - horizontalPadding, 860));
            };

            const getDisplayedTotalScale = () => renderedFitScale * zoomScale;

            const getAnchorMetrics = (anchor) => {
              if (!anchor) {
                return null;
              }

              const stageRect = stage.getBoundingClientRect();
              const viewerStageRect = viewerStage.getBoundingClientRect();
              const clientX = typeof anchor.clientX === 'number'
                ? anchor.clientX
                : stageRect.left + stageRect.width / 2;
              const clientY = typeof anchor.clientY === 'number'
                ? anchor.clientY
                : viewerStageRect.top + viewerStageRect.height / 2;

              return {
                clientX,
                clientY,
                offsetX: stage.scrollLeft + (clientX - stageRect.left),
                offsetY: viewerStage.scrollTop + (clientY - viewerStageRect.top),
              };
            };

            const restoreAnchor = (anchorMetrics, previousTotalScale, nextTotalScale) => {
              if (!anchorMetrics || !previousTotalScale || !nextTotalScale) {
                return;
              }

              const ratio = nextTotalScale / previousTotalScale;
              requestAnimationFrame(() => {
                const stageRect = stage.getBoundingClientRect();
                const viewerStageRect = viewerStage.getBoundingClientRect();
                const nextLeft = anchorMetrics.offsetX * ratio - (anchorMetrics.clientX - stageRect.left);
                const nextTop = anchorMetrics.offsetY * ratio - (anchorMetrics.clientY - viewerStageRect.top);
                stage.scrollLeft = Math.max(0, nextLeft);
                viewerStage.scrollTop = Math.max(0, nextTop);
              });
            };

            const getPage = (pageNumber) => {
              if (!pageCache.has(pageNumber)) {
                pageCache.set(pageNumber, pdfDocument.getPage(pageNumber));
              }
              return pageCache.get(pageNumber);
            };

            const getTouchDistance = (touches) => {
              if (touches.length < 2) return 0;
              const [firstTouch, secondTouch] = touches;
              return Math.hypot(secondTouch.clientX - firstTouch.clientX, secondTouch.clientY - firstTouch.clientY);
            };

            const getTouchCenter = (touches) => {
              const [firstTouch, secondTouch] = touches;
              return {
                clientX: (firstTouch.clientX + secondTouch.clientX) / 2,
                clientY: (firstTouch.clientY + secondTouch.clientY) / 2,
              };
            };

            const applyPreviewScale = () => {
              const ratio = zoomScale / renderedZoomScale;
              pages.querySelectorAll('.pdf-page-shell').forEach((frame) => {
                const renderedWidth = Number(frame.dataset.renderedWidth || '0');
                const renderedHeight = Number(frame.dataset.renderedHeight || '0');
                if (!renderedWidth || !renderedHeight) {
                  return;
                }

                const nextWidth = Math.max(1, Math.round(renderedWidth * ratio));
                const nextHeight = Math.max(1, Math.round(renderedHeight * ratio));
                frame.style.width = nextWidth + 'px';
                frame.style.height = nextHeight + 'px';

                const canvas = frame.querySelector('.pdf-page-canvas');
                if (!canvas) {
                  return;
                }

                canvas.style.width = nextWidth + 'px';
                canvas.style.height = nextHeight + 'px';
              });
            };

            const scheduleRerender = () => {
              window.clearTimeout(rerenderTimer);
              rerenderTimer = window.setTimeout(() => {
                void renderDocument(null, 'zoom');
              }, RERENDER_IDLE_MS);
            };

            const stopPan = () => {
              panState = null;
              window.removeEventListener('touchmove', handlePanMove);
              window.removeEventListener('touchend', stopPan);
              window.removeEventListener('touchcancel', stopPan);
            };

            const stopPinch = () => {
              pinchState = null;
              window.removeEventListener('touchmove', handlePinchMove);
              window.removeEventListener('touchend', stopPinch);
              window.removeEventListener('touchcancel', stopPinch);
            };

            const handlePanMove = (event) => {
              if (!panState || pinchState || event.touches.length !== 1) {
                stopPan();
                return;
              }

              const touch = event.touches[0];
              const deltaX = touch.clientX - panState.startX;
              const deltaY = touch.clientY - panState.startY;

              if (panState.mode === 'pending') {
                if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) {
                  return;
                }

                if (Math.abs(deltaX) <= Math.abs(deltaY)) {
                  stopPan();
                  return;
                }

                panState.mode = 'horizontal';
              }

              event.preventDefault();
              stage.scrollLeft = Math.max(0, panState.scrollLeft - deltaX);
            };

            const handlePinchMove = (event) => {
              if (!pinchState || event.touches.length !== 2 || !pinchState.distance) {
                return;
              }
              event.preventDefault();
              const distance = getTouchDistance(event.touches);
              if (!distance) {
                return;
              }
              const nextScale = pinchState.scale * (distance / pinchState.distance);
              setZoom(nextScale, getTouchCenter(event.touches));
            };

            const renderDocument = async (anchor = null, reason = 'rerender') => {
              if (!pdfDocument) {
                return;
              }

              const anchorMetrics = getAnchorMetrics(anchor);
              const previousTotalScale = getDisplayedTotalScale();
              const version = ++renderVersion;
              if (currentRenderTask) {
                currentRenderTask.cancel();
                currentRenderTask = null;
              }

              try {
                if (reason === 'initial') {
                  showStatus('正在渲染简历预览...');
                }

                const fragment = document.createDocumentFragment();
                let nextFitScale = renderedFitScale;
                const availableWidth = getAvailableWidth();

                for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
                  if (version !== renderVersion) {
                    return;
                  }

                  if (reason === 'initial') {
                    updateStatus('正在渲染第 ' + pageNumber + ' / ' + pdfDocument.numPages + ' 页...');
                  }

                  const page = await getPage(pageNumber);
                  const baseViewport = page.getViewport({ scale: 1 });
                  const fitScale = Math.min(1, availableWidth / baseViewport.width);
                  if (pageNumber === 1) {
                    nextFitScale = fitScale;
                  }

                  const viewport = page.getViewport({ scale: fitScale * zoomScale });
                  const outputScale = window.devicePixelRatio || 1;

                  const canvas = document.createElement('canvas');
                  const frame = document.createElement('div');
                  frame.className = 'pdf-page-shell';
                  canvas.className = 'pdf-page-canvas';
                  canvas.width = Math.floor(viewport.width * outputScale);
                  canvas.height = Math.floor(viewport.height * outputScale);
                  canvas.style.width = Math.floor(viewport.width) + 'px';
                  canvas.style.height = Math.floor(viewport.height) + 'px';
                  frame.dataset.renderedWidth = String(Math.floor(viewport.width));
                  frame.dataset.renderedHeight = String(Math.floor(viewport.height));
                  frame.style.width = Math.floor(viewport.width) + 'px';
                  frame.style.height = Math.floor(viewport.height) + 'px';

                  const context = canvas.getContext('2d');
                  if (!context) {
                    throw new Error('Canvas 2D context is not available.');
                  }

                  currentRenderTask = page.render({
                    canvasContext: context,
                    viewport,
                    transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null,
                    background: 'white',
                  });
                  await currentRenderTask.promise;
                  currentRenderTask = null;

                  frame.appendChild(canvas);
                  fragment.appendChild(frame);
                  page.cleanup();
                  if (pageNumber === 1) {
                    reportResumeLoaded();
                  }
                }

                if (version !== renderVersion) {
                  return;
                }

                pages.replaceChildren(fragment);
                pages.hidden = false;
                renderedFitScale = nextFitScale;
                renderedZoomScale = zoomScale;
                status.hidden = true;
                restoreAnchor(anchorMetrics, previousTotalScale, getDisplayedTotalScale());
              } catch (error) {
                currentRenderTask = null;
                if (error instanceof Error && error.name === 'RenderingCancelledException') {
                  return;
                }
                console.error(error);
                showError();
              }
            };

            const setZoom = (nextScale, anchor) => {
              const clampedScale = clampZoom(nextScale);
              if (Math.abs(clampedScale - zoomScale) < 0.01) {
                return;
              }

              const anchorMetrics = getAnchorMetrics(anchor);
              const previousTotalScale = getDisplayedTotalScale();
              zoomScale = clampedScale;
              applyPreviewScale();
              restoreAnchor(anchorMetrics, previousTotalScale, getDisplayedTotalScale());
              scheduleRerender();
            };

            stage.addEventListener('wheel', (event) => {
              if (!event.ctrlKey && !event.metaKey) {
                return;
              }
              event.preventDefault();
              const nextScale = zoomScale * Math.exp((-event.deltaY || 0) * 0.0025);
              setZoom(nextScale, event);
            }, { passive: false });

            stage.addEventListener('touchstart', (event) => {
              if (event.touches.length === 1) {
                if (stage.scrollWidth <= stage.clientWidth + 1) {
                  return;
                }

                stopPan();
                const touch = event.touches[0];
                panState = {
                  startX: touch.clientX,
                  startY: touch.clientY,
                  scrollLeft: stage.scrollLeft,
                  mode: 'pending',
                };
                window.addEventListener('touchmove', handlePanMove, { passive: false });
                window.addEventListener('touchend', stopPan);
                window.addEventListener('touchcancel', stopPan);
                return;
              }

              if (event.touches.length !== 2) {
                return;
              }

              stopPan();
              pinchState = {
                distance: getTouchDistance(event.touches),
                scale: zoomScale,
              };
              event.preventDefault();
              window.addEventListener('touchmove', handlePinchMove, { passive: false });
              window.addEventListener('touchend', stopPinch);
              window.addEventListener('touchcancel', stopPinch);
            }, { passive: false });

            ['gesturestart', 'gesturechange', 'gestureend'].forEach((eventName) => {
              window.addEventListener(eventName, (event) => {
                if (eventName !== 'gesturestart' && !pinchState) {
                  return;
                }
                event.preventDefault();
              }, { passive: false });
            });

            window.addEventListener('resize', () => {
              if (!pdfDocument) {
                return;
              }
              window.clearTimeout(resizeTimer);
              resizeTimer = window.setTimeout(() => {
                void renderDocument();
              }, 120);
            });

            const loadDocument = async () => {
              try {
                showStatus('正在初始化预览...');
                const pdfjsLib = await import(pdfJsUrl);
                pdfjsLib.GlobalWorkerOptions.workerSrc = pdfJsWorkerUrl;

                const loadingTask = pdfjsLib.getDocument(pdfUrl);
                loadingTask.onProgress = (progress) => {
                  if (!progress.total) {
                    updateStatus('正在下载简历...');
                    return;
                  }

                  const percent = Math.max(1, Math.min(99, Math.round((progress.loaded / progress.total) * 100)));
                  updateStatus('正在加载简历预览... ' + percent + '%');
                };

                pdfDocument = await loadingTask.promise;
                void renderDocument(null, 'initial');
              } catch (error) {
                console.error(error);
                showError();
              }
            };

            loadDocument();
          })();
        </script>
    `,
  });
}

export function renderLayout(input: {
  title?: string;
  body: string;
  pageClass?: string;
  enableInstallUi?: boolean;
  viewportContent?: string;
}): string {
  const documentTitle = !input.title || input.title === APP_NAME
    ? APP_NAME
    : `${escapeHtml(input.title)} | ${APP_NAME}`;
  const enableInstallUi = input.enableInstallUi !== false;
  const viewportContent = input.viewportContent || 'width=device-width, initial-scale=1, viewport-fit=cover';

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="${escapeHtml(viewportContent)}" />
    <meta name="robots" content="noindex,nofollow,noarchive" />
    <meta name="theme-color" content="#102542" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="${APP_NAME}" />
    <title>${documentTitle}</title>
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <style>
      :root{color-scheme:light;--bg:#f5efe5;--bg-deep:#ebe1d4;--surface:rgba(255,252,248,.88);--surface-strong:#fffdf9;--line:rgba(16,37,66,.12);--line-strong:rgba(16,37,66,.18);--text:#102542;--muted:#5a677a;--brand:#102542;--brand-2:#1c426f;--accent:#c9832f;--success:#0f766e;--danger:#b42318;--shadow:0 20px 60px rgba(16,37,66,.12);--soft:0 10px 30px rgba(16,37,66,.08)}
      *{box-sizing:border-box}html,body{min-height:100%}
      body{margin:0;color:var(--text);font-family:'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans SC',sans-serif;background:radial-gradient(circle at top left,rgba(255,244,226,.92),transparent 28%),radial-gradient(circle at bottom right,rgba(16,37,66,.12),transparent 34%),linear-gradient(180deg,#fbf7f0 0%,var(--bg) 50%,var(--bg-deep) 100%)}
      body::before{content:'';position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(16,37,66,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(16,37,66,.04) 1px,transparent 1px);background-size:36px 36px;mask-image:radial-gradient(circle at center,black 40%,transparent 92%);opacity:.35}
      body.viewer-page{overflow:hidden}
      a{color:inherit;text-decoration:none}
      button,input,textarea{font:inherit}
      h1,h2,h3{margin:0;line-height:1.08;letter-spacing:-.03em}
      p{margin:0;color:var(--muted);line-height:1.7}
      main{position:relative;z-index:1;width:min(1120px,calc(100vw - 28px));margin:0 auto;padding:18px 0 32px}
      body.centered main{min-height:100dvh;display:grid;place-items:center}
      body.viewer-page main{width:100%;max-width:none;height:100dvh;padding:0}
      input,textarea{width:100%;border:1px solid var(--line-strong);border-radius:18px;background:rgba(255,255,255,.88);color:var(--text);padding:.95rem 1rem;transition:border-color .18s ease,box-shadow .18s ease,background .18s ease;box-shadow:inset 0 1px 0 rgba(255,255,255,.9)}
      input:focus,textarea:focus{outline:none;border-color:rgba(16,37,66,.42);box-shadow:0 0 0 4px rgba(16,37,66,.08);background:#fff}
      input[readonly],textarea[readonly]{background:rgba(247,243,236,.96)}
      textarea{min-height:110px;resize:vertical}
      label{display:grid;gap:10px}
      label span{color:var(--muted);font-size:.92rem}
      .button{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;min-height:46px;padding:.85rem 1.15rem;border:1px solid transparent;border-radius:999px;font-weight:800;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,background .18s ease,border-color .18s ease}.button:hover{transform:translateY(-1px)}.button:focus-visible{outline:none;box-shadow:0 0 0 4px rgba(16,37,66,.12)}
      .button-primary{color:#fff;background:linear-gradient(135deg,var(--brand),var(--brand-2));box-shadow:0 18px 36px rgba(16,37,66,.22)}
      .button-secondary{color:var(--text);background:rgba(255,255,255,.82);border-color:var(--line-strong);box-shadow:var(--soft)}
      .button-danger{color:#fff;background:linear-gradient(135deg,#cb4b3b,#b42318);box-shadow:0 16px 34px rgba(180,35,24,.2)}
      .button-warning{color:#7c4714;background:rgba(201,131,47,.12);border-color:rgba(201,131,47,.18)}
      .button-xl{min-height:56px;padding:1rem 1.45rem;font-size:1rem}.full{width:100%}
      .panel{position:relative;overflow:hidden;background:var(--surface);border:1px solid rgba(255,255,255,.72);border-radius:28px;backdrop-filter:blur(18px);box-shadow:var(--shadow);padding:24px}
      .panel::after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(135deg,rgba(255,255,255,.22),transparent 38%)}
      .panel.narrow{width:min(620px,100%)}
      .stack,.dashboard-shell,.detail-shell,.auth-card,.dashboard-hero,.detail-hero,.section-card,.result-card,.resume-summary,.viewer-brand,.viewer-empty,.install-banner-copy{display:grid;gap:16px}
      .eyebrow{display:inline-flex;align-items:center;gap:.5rem;color:var(--accent);font-size:.78rem;font-weight:900;letter-spacing:.18em;text-transform:uppercase}
      .tag,.status-pill,.chip{display:inline-flex;align-items:center;justify-content:center;gap:.35rem;min-height:34px;padding:.42rem .78rem;border-radius:999px;font-size:.84rem;font-weight:800}
      .tag,.chip{color:var(--brand);background:rgba(255,255,255,.8);border:1px solid var(--line)}
      .status-pill.is-active{color:var(--success);background:rgba(15,118,110,.12)}.status-pill.is-inactive{color:var(--danger);background:rgba(180,35,24,.12)}
      .message-banner{position:relative;z-index:1;padding:.95rem 1.05rem;border-radius:18px;background:rgba(16,37,66,.08);color:var(--brand);border:1px solid rgba(16,37,66,.08)}.message-banner.is-danger{background:rgba(180,35,24,.12);color:var(--danger)}.message-banner.is-warning{background:rgba(201,131,47,.12);color:#8a5718}
      .subtle,.helper{color:var(--muted);font-size:.9rem}
      .helper-inline{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
      .auth-card{width:min(480px,100%);padding:30px}.auth-card h1,.dashboard-hero h1,.detail-hero h1{font-size:clamp(2rem,8vw,3rem);line-height:1.04}
      .dashboard-topbar,.detail-topbar,.section-head,.result-head,.copy-row,.viewer-topbar,.viewer-actions,.hero-actions,.row-actions{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px}
      .dashboard-copy,.detail-copy{display:grid;gap:14px;max-width:820px}
      .mini-stat-grid,.section-grid,.field-grid,.resume-meta-grid,.detail-meta-grid,.link-grid,.event-list,.event-meta-grid{display:grid;gap:14px}
      .mini-stat-grid,.detail-meta-grid,.event-meta-grid{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
      .section-grid,.field-grid,.resume-meta-grid{grid-template-columns:1fr}
      .field-grid .full-span{grid-column:1 / -1}
      .mini-stat,.resume-meta-card,.event-meta-card,.metric-card,.resume-name-card{position:relative;z-index:1;border-radius:22px;border:1px solid var(--line)}.mini-stat,.resume-meta-card,.event-meta-card,.metric-card{padding:16px 18px;background:rgba(255,255,255,.82)}.mini-stat span,.resume-meta-card span,.event-meta-card span,.metric-card span{color:var(--muted);font-size:.88rem}.mini-stat strong,.resume-meta-card strong,.event-meta-card strong,.metric-card strong{display:block;margin-top:8px;font-size:1.04rem;line-height:1.45;overflow-wrap:anywhere}
      .resume-name-card{padding:18px 20px;background:linear-gradient(135deg,rgba(16,37,66,.08),rgba(255,255,255,.72))}.resume-name-card strong{display:block;margin-top:8px;font-size:1.06rem;line-height:1.5;word-break:break-all}
      .upload-field{position:relative;display:block}.upload-input{position:absolute;inset:0;opacity:0;cursor:pointer;z-index:2}.upload-surface{position:relative;z-index:1;display:grid;gap:10px;padding:24px;border:1px dashed rgba(16,37,66,.18);border-radius:26px;background:linear-gradient(135deg,rgba(16,37,66,.05),rgba(255,255,255,.6)),rgba(255,255,255,.68);box-shadow:inset 0 1px 0 rgba(255,255,255,.75);transition:border-color .18s ease,transform .18s ease,box-shadow .18s ease}.upload-field:hover .upload-surface,.upload-field:focus-within .upload-surface{border-color:rgba(16,37,66,.34);transform:translateY(-1px);box-shadow:0 18px 32px rgba(16,37,66,.08),inset 0 1px 0 rgba(255,255,255,.75)}.upload-kicker{color:var(--accent);font-size:.78rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.upload-title{color:var(--text);font-size:1.1rem;font-weight:800;line-height:1.45;word-break:break-all}.upload-helper{color:var(--muted);font-size:.9rem}.upload-chip{display:inline-flex;align-items:center;justify-content:center;width:fit-content;padding:.65rem .95rem;border-radius:999px;background:rgba(16,37,66,.08);color:var(--brand);font-weight:700}
      .copy-stack,.link-meta{display:grid;gap:14px}.copy-row{display:grid;grid-template-columns:1fr;gap:12px;align-items:start}.copy-row textarea{min-height:110px}
      .link-grid,.event-list{display:grid;gap:16px}.link-card,.event-card{display:grid;gap:16px}.link-card h3,.event-card h3{font-size:1.28rem}.link-head,.event-card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.chip-row,.row-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-start}.detail-line{display:flex;justify-content:space-between;gap:12px;padding:.9rem 1rem;border-radius:18px;background:rgba(255,255,255,.72);border:1px solid var(--line)}.detail-line strong{color:var(--text);font-size:.94rem}.detail-line span{color:var(--muted);font-size:.88rem}.metric-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr))}.empty-state{text-align:center;color:var(--muted);padding:14px 0}
      .viewer-shell{height:100%;min-width:0;display:grid;grid-template-rows:auto minmax(0,1fr)}.viewer-topbar{position:sticky;top:0;z-index:3;min-width:0;align-items:center;padding:16px 18px;background:rgba(10,20,36,.92);color:#f7f3eb;border-bottom:1px solid rgba(255,255,255,.08);backdrop-filter:blur(18px)}.viewer-topbar.viewer-topbar-actions-only{justify-content:flex-end}.viewer-brand .eyebrow{color:rgba(255,222,186,.82)}.viewer-title{font-size:clamp(1.35rem,4.5vw,2rem);font-weight:900}.viewer-meta,.viewer-hint{color:rgba(247,243,235,.84)}.viewer-hint{font-size:.92rem}.viewer-stage{min-width:0;min-height:0;overflow-y:auto;overflow-x:hidden;padding:18px 14px 32px;background:radial-gradient(circle at top right,rgba(16,37,66,.08),transparent 28%),linear-gradient(180deg,#efe7da 0%,#dfd3c0 100%);overscroll-behavior:contain;-webkit-overflow-scrolling:touch}.pdf-scroll-stage{width:100%;max-width:100%;overflow-x:auto;overflow-y:visible;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y}.pdf-stage-shell{width:max-content;min-width:min(100%,860px);margin:0 auto;display:grid;justify-items:center;gap:18px}.pdf-status{max-width:100%;padding:14px 16px;border-radius:18px;background:rgba(255,255,255,.72);border:1px solid var(--line);color:var(--muted);text-align:center}.pdf-pages{display:grid;gap:18px;width:max-content;min-width:100%;justify-items:center;margin:0 auto}.pdf-page-shell{width:fit-content;justify-self:center}.pdf-page-canvas{display:block;max-width:none;background:#fff}.viewer-empty-wrap{display:grid;place-items:center;padding:14px}.viewer-empty{align-self:center;justify-self:center}
      .install-banner-shell{position:fixed;left:16px;right:16px;bottom:16px;z-index:40}.install-banner-shell[hidden]{display:none}.install-banner{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px 18px;border-radius:24px;background:rgba(8,18,33,.92);color:#f7f3eb;border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(18px);box-shadow:0 20px 60px rgba(8,18,33,.28)}.install-banner p{color:rgba(247,243,235,.8)}.install-banner-actions{display:flex;flex-wrap:wrap;gap:10px}.install-banner .button-secondary{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.14);color:#fff;box-shadow:none}.install-banner .button-warning{color:#ffd7a7;background:rgba(201,131,47,.14);border-color:rgba(201,131,47,.18)}
      .reveal{animation:rise .42s ease both}@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      @media (min-width:720px){main{width:min(1180px,calc(100vw - 40px));padding:24px 0 40px}.copy-row{grid-template-columns:1fr auto}.field-grid,.resume-meta-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media (min-width:960px){.section-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.link-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media (min-width:1200px){.link-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media (max-width:719px){.viewer-shell{min-height:100dvh}.viewer-stage{padding:14px 10px 24px}.install-banner{display:grid}}
      @media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
    </style>
  </head>
  <body class="${escapeHtml(input.pageClass || '')}">
    <main>
      ${input.body}
    </main>
    ${
      enableInstallUi
        ? `
          <div class="install-banner-shell" hidden data-install-shell>
            <div class="install-banner">
              <div class="install-banner-copy">
                <div class="eyebrow">${APP_NAME}</div>
                <strong data-install-title>安装应用</strong>
                <p data-install-copy>将后台固定到手机或桌面，像 App 一样直接打开。</p>
              </div>
              <div class="install-banner-actions">
                <button type="button" class="button button-warning" data-install-action hidden>立即安装</button>
                <button type="button" class="button button-secondary" data-install-dismiss>稍后</button>
              </div>
            </div>
          </div>
          <script>
            (() => {
              const shell = document.querySelector('[data-install-shell]');
              const title = document.querySelector('[data-install-title]');
              const copy = document.querySelector('[data-install-copy]');
              const action = document.querySelector('[data-install-action]');
              const dismiss = document.querySelector('[data-install-dismiss]');
              const storageKey = 'trackresume-install-dismissed-v1';

              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                }, { once: true });
              }

              if (!shell || !title || !copy || !action || !dismiss) {
                return;
              }

              let deferredPrompt = null;
              const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
              const ua = window.navigator.userAgent.toLowerCase();
              const isIos = /iphone|ipad|ipod/.test(ua);
              const isSafari = /safari/.test(ua) && !/crios|fxios|edgios/.test(ua);

              const showBanner = (mode) => {
                if (window.localStorage.getItem(storageKey) === '1' || isStandalone) {
                  return;
                }

                if (mode === 'prompt') {
                  title.textContent = '安装 TrackResume';
                  copy.textContent = '将后台固定到手机或桌面，下一次可直接从主屏幕或桌面打开。';
                  action.hidden = false;
                } else {
                  title.textContent = '添加到主屏幕';
                  copy.textContent = '在 Safari 中点“分享”，再选择“添加到主屏幕”，即可把 TrackResume 安装到 iPhone 或 iPad。';
                  action.hidden = true;
                }

                shell.hidden = false;
              };

              const hideBanner = (persist) => {
                shell.hidden = true;
                if (persist) {
                  window.localStorage.setItem(storageKey, '1');
                }
              };

              dismiss.addEventListener('click', () => {
                hideBanner(true);
              });

              action.addEventListener('click', async () => {
                if (!deferredPrompt) {
                  return;
                }

                deferredPrompt.prompt();
                try {
                  await deferredPrompt.userChoice;
                } finally {
                  deferredPrompt = null;
                  hideBanner(true);
                }
              });

              window.addEventListener('beforeinstallprompt', (event) => {
                event.preventDefault();
                deferredPrompt = event;
                showBanner('prompt');
              });

              if (isIos && isSafari && !isStandalone) {
                showBanner('ios');
              }
            })();
          </script>
        `
        : ''
    }
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
    title: APP_NAME,
    pageClass: 'admin-page',
    body: `
      <section class="dashboard-shell">
        <header class="panel dashboard-hero reveal">
          <div class="dashboard-topbar">
            <div class="dashboard-copy">
              <div class="eyebrow">${APP_NAME}</div>
              <h1>简历追踪后台</h1>
              <p>上传当前 PDF，生成招聘专属链接，按单条链接查看访问行为，并支持停用或永久删除。</p>
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
            <span class="helper">移动端优先卡片布局，支持永久删除</span>
          </div>
          ${
            input.links.length
              ? `<div class="link-grid">${input.links.map((link) => renderLinkCard(link, input.origin)).join('')}</div>`
              : '<p class="empty-state">还没有任何分享链接。</p>'
          }
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
  const targetName = input.link.company_name || '未填写公司';
  const recruiterName = input.link.recruiter_name || '未填写招聘者';
  const platformName = input.link.platform_name || '未填写平台';
  const roleTitle = input.link.role_title || '未填写岗位';

  return renderLayout({
    title: APP_NAME,
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

          <div class="row-actions">
            <a class="button button-secondary" href="${escapeHtml(shareUrl)}" target="_blank" rel="noreferrer">打开链接</a>
            ${
              status.active
                ? `
                  <form method="post" action="/admin/links/${encodeURIComponent(input.link.slug)}/revoke">
                    <button type="submit" class="button button-warning">停用链接</button>
                  </form>
                `
                : ''
            }
            <form method="post" action="/admin/links/${encodeURIComponent(input.link.slug)}/delete" data-confirm-message="删除后，这个链接和全部访问记录都会永久移除，继续吗？">
              <button type="submit" class="button button-danger">永久删除</button>
            </form>
          </div>
        </section>

        <section class="panel reveal">
          <div class="section-head">
            <div>
              <div class="eyebrow">Event Feed</div>
              <h2>访问记录</h2>
            </div>
            <span class="helper">最多展示最近 200 条事件，包含访问 IP 与访客标识</span>
          </div>
          ${
            input.events.length
              ? `<div class="event-list">${input.events.map((event) => renderEventCard(event)).join('')}</div>`
              : '<p class="empty-state">这个链接还没有访问记录。</p>'
          }
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

function renderLinkCard(link: ShareLink, origin: string): string {
  const shareUrl = `${origin}/r/${link.slug}`;
  const status = getLinkAvailability(link);

  return `
    <article class="panel link-card">
      <div class="link-head">
        <div class="stack">
          <div class="eyebrow">Share Link</div>
          <h3>${escapeHtml(link.company_name || '未填写公司')}</h3>
        </div>
        <span class="status-pill ${status.active ? 'is-active' : 'is-inactive'}">${escapeHtml(status.label)}</span>
      </div>

      <div class="chip-row">
        <span class="chip">${escapeHtml(link.platform_name || '未填写平台')}</span>
        <span class="chip">${escapeHtml(link.recruiter_name || '未填写招聘者')}</span>
        <span class="chip">${escapeHtml(link.role_title || '未填写岗位')}</span>
      </div>

      <div class="link-meta">
        ${
          link.note
            ? `<div class="detail-line"><span>备注</span><strong>${escapeHtml(link.note)}</strong></div>`
            : ''
        }
        ${
          link.expires_at
            ? `<div class="detail-line"><span>过期时间</span><strong>${escapeHtml(formatDateTime(link.expires_at))}</strong></div>`
            : ''
        }
        <div class="detail-line"><span>最近活动</span><strong>${escapeHtml(formatDateTime(link.last_event_at || link.created_at))}</strong></div>
      </div>

      <label>
        <span>分享链接</span>
        <div class="copy-row">
          <input type="text" value="${escapeHtml(shareUrl)}" readonly />
          <button type="button" class="button button-secondary copy-trigger" data-copy="${escapeHtml(shareUrl)}" data-label="复制链接">复制链接</button>
        </div>
      </label>

      <div class="metric-grid">
        <div class="metric-card">
          <span>页面打开</span>
          <strong>${link.page_open_count}</strong>
        </div>
        <div class="metric-card">
          <span>PDF 已加载</span>
          <strong>${link.resume_view_count}</strong>
        </div>
        <div class="metric-card">
          <span>下载次数</span>
          <strong>${link.download_count}</strong>
        </div>
      </div>

      <div class="row-actions">
        <a class="button button-secondary" href="/admin/links/${encodeURIComponent(link.slug)}/events">访问记录</a>
        <a class="button button-secondary" href="${escapeHtml(shareUrl)}" target="_blank" rel="noreferrer">打开链接</a>
        ${
          status.active
            ? `
              <form method="post" action="/admin/links/${encodeURIComponent(link.slug)}/revoke">
                <button type="submit" class="button button-warning">停用</button>
              </form>
            `
            : ''
        }
        <form method="post" action="/admin/links/${encodeURIComponent(link.slug)}/delete" data-confirm-message="删除后，这个链接和全部访问记录都会永久移除，继续吗？">
          <button type="submit" class="button button-danger">删除</button>
        </form>
      </div>
    </article>
  `;
}

function renderEventCard(event: ViewEvent): string {
  const viewer = event.viewer_id ? event.viewer_id.slice(0, 12) : '无';
  const ipAddress = event.ip_address || '未知';

  return `
    <article class="panel event-card">
      <div class="event-card-head">
        <div class="stack">
          <div class="eyebrow">${escapeHtml(renderEventLabel(event.event_type))}</div>
          <h3>${escapeHtml(formatDateTime(event.occurred_at))}</h3>
        </div>
        <span class="tag">${escapeHtml(renderEventLabel(event.event_type))}</span>
      </div>

      <div class="event-meta-grid">
        <div class="event-meta-card">
          <span>IP</span>
          <strong>${escapeHtml(ipAddress)}</strong>
        </div>
        <div class="event-meta-card">
          <span>位置</span>
          <strong>${escapeHtml(renderLocation(event))}</strong>
        </div>
        <div class="event-meta-card">
          <span>访客标识</span>
          <strong>${escapeHtml(viewer)}</strong>
        </div>
        <div class="event-meta-card">
          <span>设备</span>
          <strong>${escapeHtml(summarizeUserAgent(event.user_agent))}</strong>
        </div>
        <div class="event-meta-card">
          <span>来源</span>
          <strong>${escapeHtml(summarizeReferer(event.referer))}</strong>
        </div>
      </div>
    </article>
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

        document.querySelectorAll('form[data-confirm-message]').forEach((form) => {
          form.addEventListener('submit', (event) => {
            const message = form.getAttribute('data-confirm-message') || '确认继续吗？';
            if (!window.confirm(message)) {
              event.preventDefault();
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

        document.querySelectorAll('form[data-confirm-message]').forEach((form) => {
          form.addEventListener('submit', (event) => {
            const message = form.getAttribute('data-confirm-message') || '确认继续吗？';
            if (!window.confirm(message)) {
              event.preventDefault();
            }
          });
        });
      })();
    </script>
  `;
}
