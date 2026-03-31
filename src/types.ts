export interface Env {
  DB: D1Database;
  RESUME_BUCKET: R2Bucket;
  ADMIN_PASSWORD?: string;
  SITE_OWNER_NAME?: string;
  SITE_INTRO?: string;
  ALLOW_DOWNLOAD_BUTTON?: string;
  LINK_EXPIRE_DAYS?: string;
}

export interface ShareLink {
  id: number;
  slug: string;
  recruiter_name: string | null;
  company_name: string | null;
  role_title: string | null;
  platform_name: string | null;
  note: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
  last_event_at: string | null;
  page_open_count: number;
  resume_view_count: number;
  download_count: number;
}

export interface ViewEvent {
  id: number;
  share_link_id: number;
  slug: string;
  recruiter_name: string | null;
  company_name: string | null;
  role_title: string | null;
  platform_name: string | null;
  event_type: string;
  occurred_at: string;
  viewer_id: string | null;
  ip_address: string | null;
  country: string | null;
  city: string | null;
  colo: string | null;
  user_agent: string | null;
  referer: string | null;
  details_json: string | null;
}

export interface SessionPayload {
  role: 'admin';
  exp: number;
}

export type RequestWithCf = Request & {
  cf?: Record<string, unknown>;
};

export const ADMIN_COOKIE = 'resume_admin_session';
export const VIEWER_COOKIE = 'resume_viewer_id';
export const ACTIVE_RESUME_KEY = 'active_resume_key';
export const ACTIVE_RESUME_NAME = 'active_resume_name';
export const ACTIVE_RESUME_SIZE = 'active_resume_size';
export const ACTIVE_RESUME_UPLOADED_AT = 'active_resume_uploaded_at';
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
