import {
  createUniqueSlug,
  getLinkAvailability,
  getSettings,
  getShareLinkBySlug,
  listRecentEvents,
  listShareLinks,
  recordEvent,
  setSetting,
} from './db';
import {
  renderAdminDashboardPage,
  renderAdminLoginPage,
  renderInvalidLinkPage,
  renderLandingPage,
  renderLayout,
  renderPublicResumePage,
} from './html';
import {
  ACTIVE_RESUME_KEY,
  ACTIVE_RESUME_NAME,
  ACTIVE_RESUME_SIZE,
  ACTIVE_RESUME_UPLOADED_AT,
  ADMIN_COOKIE,
  Env,
  MAX_UPLOAD_BYTES,
  VIEWER_COOKIE,
} from './types';
import {
  applyCommonHeaders,
  generateId,
  htmlResponse,
  isTruthy,
  jsonResponse,
  normalizeText,
  parseCookies,
  parseLocalDateTime,
  redirect,
  sanitizeFileName,
  serializeCookie,
  signSession,
  stripTrailingSlash,
  textResponse,
  truncate,
  verifySession,
} from './utils';

export default {
  async fetch(request, env): Promise<Response> {
    try {
      const response = await routeRequest(request, env);
      return applyCommonHeaders(response);
    } catch (error) {
      console.error(error);
      return applyCommonHeaders(
        htmlResponse(
          renderLayout({
            title: 'Server error',
            pageClass: 'centered',
            body: '<section class="panel narrow"><h1>服务异常</h1><p>站点暂时不可用，请稍后再试。</p></section>',
          }),
          500,
        ),
      );
    }
  },
} satisfies ExportedHandler<Env>;

async function routeRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathname = stripTrailingSlash(url.pathname);

  if (pathname === '/robots.txt') {
    return textResponse('User-agent: *\nDisallow: /\n', 200, {
      'Content-Type': 'text/plain; charset=utf-8',
    });
  }

  if (pathname === '/favicon.ico') {
    return new Response(null, { status: 204 });
  }

  if (pathname === '/') {
    return htmlResponse(renderLandingPage({
      ownerName: env.SITE_OWNER_NAME || 'Private Resume',
      intro: env.SITE_INTRO || 'Private resume access for recruiters only.',
    }));
  }

  if (pathname === '/admin/login' && request.method === 'GET') {
    return htmlResponse(renderAdminLoginPage());
  }

  if (pathname === '/admin/login' && request.method === 'POST') {
    return handleAdminLogin(request, env);
  }

  if (pathname === '/admin/logout' && request.method === 'POST') {
    return handleAdminLogout();
  }

  if (pathname === '/admin' && request.method === 'GET') {
    return handleAdminDashboard(request, env);
  }

  if (pathname === '/admin/upload-resume' && request.method === 'POST') {
    return handleResumeUpload(request, env);
  }

  if (pathname === '/admin/create-link' && request.method === 'POST') {
    return handleCreateLink(request, env);
  }

  const revokeMatch = pathname.match(/^\/admin\/links\/([A-Za-z0-9_-]+)\/revoke$/);
  if (revokeMatch && request.method === 'POST') {
    return handleRevokeLink(request, env, revokeMatch[1]);
  }

  const resumePageMatch = pathname.match(/^\/r\/([A-Za-z0-9_-]+)$/);
  if (resumePageMatch && request.method === 'GET') {
    return handlePublicResumePage(request, env, resumePageMatch[1]);
  }

  const resumePdfMatch = pathname.match(/^\/r\/([A-Za-z0-9_-]+)\/pdf$/);
  if (resumePdfMatch && (request.method === 'GET' || request.method === 'HEAD')) {
    return handlePublicResumePdf(request, env, resumePdfMatch[1]);
  }

  const eventMatch = pathname.match(/^\/r\/([A-Za-z0-9_-]+)\/event$/);
  if (eventMatch && request.method === 'POST') {
    return handlePublicEvent(request, env, eventMatch[1]);
  }

  return htmlResponse(
    renderLayout({
      title: 'Not found',
      pageClass: 'centered',
      body: '<section class="panel narrow"><h1>链接无效</h1><p>请确认你打开的是完整的简历专属链接。</p></section>',
    }),
    404,
  );
}

async function handleAdminLogin(request: Request, env: Env): Promise<Response> {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
    return htmlResponse(renderAdminLoginPage('请先在 Cloudflare 中配置 ADMIN_PASSWORD 和 SESSION_SECRET。'), 500);
  }

  const form = await request.formData();
  const password = normalizeText(form.get('password'));
  if (!password || password !== env.ADMIN_PASSWORD) {
    return htmlResponse(renderAdminLoginPage('密码不正确。'), 401);
  }

  const session = await signSession(env.SESSION_SECRET, {
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
  });

  const response = redirect('/admin');
  response.headers.append('Set-Cookie', serializeCookie(ADMIN_COOKIE, session, {
    httpOnly: true,
    sameSite: 'Strict',
    secure: true,
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  }));
  return response;
}

function handleAdminLogout(): Response {
  const response = redirect('/admin/login');
  response.headers.append('Set-Cookie', serializeCookie(ADMIN_COOKIE, '', {
    httpOnly: true,
    sameSite: 'Strict',
    secure: true,
    path: '/',
    maxAge: 0,
  }));
  return response;
}

async function handleAdminDashboard(request: Request, env: Env): Promise<Response> {
  if (!(await isAdminAuthenticated(request, env))) {
    return redirect('/admin/login');
  }

  const url = new URL(request.url);
  const [settings, links, events] = await Promise.all([
    getSettings(env.DB),
    listShareLinks(env.DB),
    listRecentEvents(env.DB),
  ]);

  const createdSlug = url.searchParams.get('created');
  const message = url.searchParams.get('message');
  const shareUrl = createdSlug ? `${url.origin}/r/${createdSlug}` : '';
  const suggestedText = shareUrl
    ? `您好，这是我的完整简历专属链接，打开即可直接查看 PDF：${shareUrl}`
    : '';

  return htmlResponse(renderAdminDashboardPage({
    origin: url.origin,
    links,
    events,
    createdSlug,
    shareUrl,
    suggestedText,
    activeResumeKey: settings.get(ACTIVE_RESUME_KEY) || '',
    activeResumeName: settings.get(ACTIVE_RESUME_NAME) || '',
    activeResumeSize: settings.get(ACTIVE_RESUME_SIZE) || '',
    activeResumeUploadedAt: settings.get(ACTIVE_RESUME_UPLOADED_AT) || '',
    allowDownloadButton: isTruthy(env.ALLOW_DOWNLOAD_BUTTON),
    defaultExpireDays: Number.parseInt(env.LINK_EXPIRE_DAYS || '30', 10) || 30,
    message,
  }));
}

async function handleResumeUpload(request: Request, env: Env): Promise<Response> {
  if (!(await isAdminAuthenticated(request, env))) {
    return redirect('/admin/login');
  }

  const form = await request.formData();
  const file = form.get('resume');
  if (!(file instanceof File)) {
    return redirectToAdminMessage('请先选择一个PDF文件');
  }

  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    return redirectToAdminMessage('PDF大小需要在10MB以内');
  }

  const safeName = sanitizeFileName(file.name || 'resume.pdf');
  if (!safeName.toLowerCase().endsWith('.pdf')) {
    return redirectToAdminMessage('仅支持PDF格式');
  }

  const key = `resume/${Date.now()}-${safeName}`;
  await env.RESUME_BUCKET.put(key, file.stream(), {
    httpMetadata: {
      contentType: 'application/pdf',
      contentDisposition: `inline; filename="${safeName}"`,
      cacheControl: 'private, no-store',
    },
    customMetadata: {
      originalName: safeName,
      uploadedAt: new Date().toISOString(),
    },
  });

  await Promise.all([
    setSetting(env.DB, ACTIVE_RESUME_KEY, key),
    setSetting(env.DB, ACTIVE_RESUME_NAME, safeName),
    setSetting(env.DB, ACTIVE_RESUME_SIZE, String(file.size)),
    setSetting(env.DB, ACTIVE_RESUME_UPLOADED_AT, new Date().toISOString()),
  ]);

  return redirectToAdminMessage('简历已上传');
}

async function handleCreateLink(request: Request, env: Env): Promise<Response> {
  if (!(await isAdminAuthenticated(request, env))) {
    return redirect('/admin/login');
  }

  const form = await request.formData();
  const slug = await createUniqueSlug(env.DB);
  const recruiterName = truncate(normalizeText(form.get('recruiter_name')), 80);
  const companyName = truncate(normalizeText(form.get('company_name')), 120);
  const roleTitle = truncate(normalizeText(form.get('role_title')), 120);
  const platformName = truncate(normalizeText(form.get('platform_name')), 80);
  const note = truncate(normalizeText(form.get('note')), 240);
  const expiresAt = parseLocalDateTime(normalizeText(form.get('expires_at')));

  await env.DB.prepare(`
    INSERT INTO share_links (
      slug,
      recruiter_name,
      company_name,
      role_title,
      platform_name,
      note,
      expires_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    slug,
    recruiterName,
    companyName,
    roleTitle,
    platformName,
    note,
    expiresAt,
  ).run();

  return redirect(`/admin?created=${encodeURIComponent(slug)}`);
}

async function handleRevokeLink(request: Request, env: Env, slug: string): Promise<Response> {
  if (!(await isAdminAuthenticated(request, env))) {
    return redirect('/admin/login');
  }

  await env.DB.prepare(
    'UPDATE share_links SET revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE slug = ?',
  ).bind(slug).run();

  return redirectToAdminMessage('链接已停用');
}

async function handlePublicResumePage(request: Request, env: Env, slug: string): Promise<Response> {
  const link = await getShareLinkBySlug(env.DB, slug);
  if (!link) {
    return htmlResponse(renderInvalidLinkPage('链接不存在或已失效。'), 404);
  }

  const availability = getLinkAvailability(link);
  if (!availability.active) {
    return htmlResponse(renderInvalidLinkPage(availability.reason), availability.status);
  }

  const settings = await getSettings(env.DB);
  const viewerId = getViewerId(request) || generateId(12);
  await recordEvent(env, request, link, 'page_open', viewerId, null);

  const response = htmlResponse(renderPublicResumePage({
    origin: new URL(request.url).origin,
    link,
    ownerName: env.SITE_OWNER_NAME || 'Your Name',
    ownerTitle: env.SITE_OWNER_TITLE || 'Resume Portal',
    intro: env.SITE_INTRO || 'Private resume access for recruiters only.',
    hasResume: Boolean(settings.get(ACTIVE_RESUME_KEY)),
    allowDownloadButton: isTruthy(env.ALLOW_DOWNLOAD_BUTTON),
  }));

  if (!getViewerId(request)) {
    response.headers.append('Set-Cookie', serializeCookie(VIEWER_COOKIE, viewerId, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: true,
      path: '/',
      maxAge: 180 * 24 * 60 * 60,
    }));
  }

  return response;
}

async function handlePublicResumePdf(request: Request, env: Env, slug: string): Promise<Response> {
  const link = await getShareLinkBySlug(env.DB, slug);
  if (!link) {
    return textResponse('Link not found', 404);
  }

  const availability = getLinkAvailability(link);
  if (!availability.active) {
    return textResponse(availability.reason, availability.status);
  }

  const settings = await getSettings(env.DB);
  const key = settings.get(ACTIVE_RESUME_KEY);
  const fileName = sanitizeFileName(settings.get(ACTIVE_RESUME_NAME) || 'resume.pdf');
  if (!key) {
    return textResponse('Resume file is not available yet.', 503);
  }

  const object = await env.RESUME_BUCKET.get(key, { range: request.headers });
  if (!object) {
    return textResponse('Resume file not found in storage.', 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Type', headers.get('Content-Type') || 'application/pdf');
  headers.set('Cache-Control', 'private, no-store');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');

  const shouldDownload = new URL(request.url).searchParams.get('download') === '1';
  headers.set('Content-Disposition', `${shouldDownload ? 'attachment' : 'inline'}; filename="${fileName}"`);

  const hasRange = request.headers.has('Range');
  if (shouldDownload && !hasRange) {
    await recordEvent(env, request, link, 'download', getViewerId(request), null);
  }

  return new Response(request.method === 'HEAD' ? null : object.body, {
    status: hasRange ? 206 : 200,
    headers,
  });
}

async function handlePublicEvent(request: Request, env: Env, slug: string): Promise<Response> {
  const link = await getShareLinkBySlug(env.DB, slug);
  if (!link) {
    return jsonResponse({ ok: false }, 404);
  }

  const availability = getLinkAvailability(link);
  if (!availability.active) {
    return jsonResponse({ ok: false }, availability.status);
  }

  let eventType = '';
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    eventType = String(payload.type || '');
  } catch {
    return jsonResponse({ ok: false }, 400);
  }

  if (eventType !== 'resume_loaded') {
    return jsonResponse({ ok: false }, 400);
  }

  await recordEvent(env, request, link, eventType, getViewerId(request), null);
  return jsonResponse({ ok: true });
}

async function isAdminAuthenticated(request: Request, env: Env): Promise<boolean> {
  if (!env.SESSION_SECRET) {
    return false;
  }

  const cookie = parseCookies(request.headers.get('Cookie') || '').get(ADMIN_COOKIE);
  if (!cookie) {
    return false;
  }

  const payload = await verifySession(env.SESSION_SECRET, cookie);
  return Boolean(payload && payload.role === 'admin' && payload.exp > Math.floor(Date.now() / 1000));
}

function redirectToAdminMessage(message: string): Response {
  return redirect(`/admin?message=${encodeURIComponent(message)}`);
}
function getViewerId(request: Request): string | null {
  return parseCookies(request.headers.get('Cookie') || '').get(VIEWER_COOKIE) || null;
}



