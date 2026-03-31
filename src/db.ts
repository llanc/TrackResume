import {
  Env,
  RequestWithCf,
  ShareLink,
  ViewEvent,
} from './types';
import { generateId, stringOrNull } from './utils';

export async function getSettings(db: D1Database): Promise<Map<string, string>> {
  const result = await db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>();
  const entries = result.results || [];
  return new Map(entries.map((entry) => [entry.key, entry.value]));
}

export async function setSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).bind(key, value).run();
}

export async function getShareLinkBySlug(db: D1Database, slug: string): Promise<ShareLink | null> {
  const result = await db.prepare(`
    SELECT
      id,
      slug,
      recruiter_name,
      company_name,
      role_title,
      platform_name,
      note,
      expires_at,
      revoked_at,
      created_at,
      updated_at,
      last_event_at,
      page_open_count,
      resume_view_count,
      download_count
    FROM share_links
    WHERE slug = ?
    LIMIT 1
  `).bind(slug).first<ShareLink>();

  return result || null;
}

export async function listShareLinks(db: D1Database): Promise<ShareLink[]> {
  const result = await db.prepare(`
    SELECT
      id,
      slug,
      recruiter_name,
      company_name,
      role_title,
      platform_name,
      note,
      expires_at,
      revoked_at,
      created_at,
      updated_at,
      last_event_at,
      page_open_count,
      resume_view_count,
      download_count
    FROM share_links
    ORDER BY created_at DESC
    LIMIT 100
  `).all<ShareLink>();

  return result.results || [];
}

export async function listEventsForShareLink(db: D1Database, slug: string): Promise<ViewEvent[]> {
  const result = await db.prepare(`
    SELECT
      e.id,
      e.share_link_id,
      e.event_type,
      e.occurred_at,
      e.viewer_id,
      e.ip_address,
      e.country,
      e.city,
      e.colo,
      e.user_agent,
      e.referer,
      e.details_json,
      l.slug,
      l.recruiter_name,
      l.company_name,
      l.role_title,
      l.platform_name
    FROM view_events e
    INNER JOIN share_links l ON l.id = e.share_link_id
    WHERE l.slug = ?
    ORDER BY e.occurred_at DESC
    LIMIT 200
  `).bind(slug).all<ViewEvent>();

  return result.results || [];
}

export async function createUniqueSlug(db: D1Database): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = generateId(9);
    const existing = await db.prepare(
      'SELECT slug FROM share_links WHERE slug = ? LIMIT 1',
    ).bind(slug).first<{ slug: string }>();
    if (!existing) {
      return slug;
    }
  }

  throw new Error('Unable to create unique slug.');
}

export function getLinkAvailability(link: ShareLink): {
  active: boolean;
  status: number;
  label: string;
  reason: string;
} {
  if (link.revoked_at) {
    return {
      active: false,
      status: 410,
      label: '已停用',
      reason: '此链接已被手动停用。',
    };
  }

  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    return {
      active: false,
      status: 410,
      label: '已过期',
      reason: '此链接已经过期。',
    };
  }

  return {
    active: true,
    status: 200,
    label: '有效',
    reason: '',
  };
}

export async function recordEvent(
  env: Env,
  request: Request,
  link: ShareLink,
  eventType: string,
  viewerId: string | null,
  details: Record<string, unknown> | null,
): Promise<void> {
  const requestWithCf = request as RequestWithCf;
  const cf = requestWithCf.cf || {};
  const detailsJson = details ? JSON.stringify(details) : null;
  const ipAddress = stringOrNull(request.headers.get('CF-Connecting-IP'));

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO view_events (
        share_link_id,
        event_type,
        viewer_id,
        ip_address,
        country,
        city,
        colo,
        user_agent,
        referer,
        details_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      link.id,
      eventType,
      viewerId,
      ipAddress,
      stringOrNull(cf.country),
      stringOrNull(cf.city),
      stringOrNull(cf.colo),
      request.headers.get('user-agent'),
      request.headers.get('referer'),
      detailsJson,
    ),
    env.DB.prepare(`
      UPDATE share_links
      SET
        updated_at = CURRENT_TIMESTAMP,
        last_event_at = CURRENT_TIMESTAMP,
        page_open_count = page_open_count + ?,
        resume_view_count = resume_view_count + ?,
        download_count = download_count + ?
      WHERE id = ?
    `).bind(
      eventType === 'page_open' ? 1 : 0,
      eventType === 'resume_loaded' ? 1 : 0,
      eventType === 'download' ? 1 : 0,
      link.id,
    ),
  ]);
}
