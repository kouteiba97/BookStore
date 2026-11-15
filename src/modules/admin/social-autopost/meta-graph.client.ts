import { createHmac } from 'crypto';
import { GraphApiError } from './meta-errors';

/**
 * The few Graph API calls the auto-poster needs, over plain fetch.
 *
 * The version is pinned (calls to an expired version are silently re-routed
 * by Meta, so an unpinned client changes behaviour without warning). v25.0 is
 * supported until 29 July 2028; override with META_GRAPH_VERSION.
 */
export const DEFAULT_GRAPH_VERSION = 'v25.0';
const TIMEOUT_MS = 30_000;

export interface PageInfo {
  id: string;
  name: string;
  accessToken?: string;
  instagram?: { id: string; username?: string } | null;
}

export interface TokenInfo {
  valid: boolean;
  /** null = never expires. */
  expiresAt: Date | null;
  scopes: string[];
}

export type IgContainerStatus = 'IN_PROGRESS' | 'FINISHED' | 'PUBLISHED' | 'ERROR' | 'EXPIRED';

/** What the auto-poster needs from Meta — a real client and a dry-run fake implement it. */
export interface MetaApi {
  readonly dryRun: boolean;
  inspectToken(token: string): Promise<TokenInfo>;
  listPages(token: string): Promise<PageInfo[]>;
  getPage(token: string, pageId: string): Promise<PageInfo>;
  /** Facebook photo post, now (`when` null) or in Meta's scheduler. Returns the feed post id. */
  postPhoto(pageToken: string, pageId: string, imageUrl: string, caption: string, when: Date | null): Promise<string>;
  deletePost(pageToken: string, postId: string): Promise<void>;
  /**
   * After an uncertain failure: did Meta create the post anyway? Looks through
   * the Page's scheduled and recent posts for this caption. Returns its id.
   */
  findPostByCaption(pageToken: string, pageId: string, caption: string): Promise<string | null>;
  getPostState(pageToken: string, postId: string): Promise<{ published: boolean; permalink: string | null }>;
  igCreateContainer(token: string, igUserId: string, imageUrl: string, caption: string): Promise<string>;
  igContainerStatus(token: string, containerId: string): Promise<IgContainerStatus>;
  igPublish(token: string, igUserId: string, containerId: string): Promise<string>;
  igPermalink(token: string, mediaId: string): Promise<string | null>;
  exchangeToken(token: string): Promise<{ token: string; expiresAt: Date | null } | null>;
}

export class MetaGraphClient implements MetaApi {
  readonly dryRun = false;
  private readonly base: string;

  constructor(
    version = process.env.META_GRAPH_VERSION?.trim() || DEFAULT_GRAPH_VERSION,
    private readonly appSecret = process.env.META_APP_SECRET?.trim() || '',
    private readonly appId = process.env.META_APP_ID?.trim() || '',
  ) {
    this.base = `https://graph.facebook.com/${version}`;
  }

  async inspectToken(token: string): Promise<TokenInfo> {
    // The app token (id|secret) can always inspect; without it, the token
    // inspects itself, which Meta allows for most token types.
    const inspector = this.appId && this.appSecret ? `${this.appId}|${this.appSecret}` : token;
    const r = await this.call<{ data: { is_valid: boolean; expires_at?: number; scopes?: string[] } }>(
      'GET',
      '/debug_token',
      inspector,
      { input_token: token },
    );
    const exp = r.data.expires_at ?? 0;
    return {
      valid: r.data.is_valid === true,
      expiresAt: exp > 0 ? new Date(exp * 1000) : null,
      scopes: r.data.scopes ?? [],
    };
  }

  async listPages(token: string): Promise<PageInfo[]> {
    const r = await this.call<{ data: RawPage[] }>('GET', '/me/accounts', token, {
      fields: 'id,name,access_token,instagram_business_account{id,username}',
      limit: '50',
    });
    return (r.data ?? []).map(toPage);
  }

  async getPage(token: string, pageId: string): Promise<PageInfo> {
    const r = await this.call<RawPage>('GET', `/${encodeURIComponent(pageId)}`, token, {
      fields: 'id,name,access_token,instagram_business_account{id,username}',
    });
    return toPage(r);
  }

  async postPhoto(pageToken: string, pageId: string, imageUrl: string, caption: string, when: Date | null) {
    const params: Record<string, string> = { url: imageUrl, caption };
    if (when) {
      params.published = 'false';
      params.scheduled_publish_time = String(Math.floor(when.getTime() / 1000));
    }
    const r = await this.call<{ id: string; post_id?: string }>('POST', `/${encodeURIComponent(pageId)}/photos`, pageToken, params);
    return r.post_id ?? r.id;
  }

  async deletePost(pageToken: string, postId: string) {
    await this.call('DELETE', `/${encodeURIComponent(postId)}`, pageToken, {});
  }

  async findPostByCaption(pageToken: string, pageId: string, caption: string) {
    const want = captionKey(caption);
    const page = encodeURIComponent(pageId);
    for (const [edge, fields] of [
      ['scheduled_posts', 'id,message'],
      ['posts', 'id,message'],
    ] as const) {
      const r = await this.call<{ data: { id: string; message?: string }[] }>('GET', `/${page}/${edge}`, pageToken, {
        fields,
        limit: '50',
      });
      const hit = (r.data ?? []).find((p) => p.message && captionKey(p.message) === want);
      if (hit) return hit.id;
    }
    return null;
  }

  async getPostState(pageToken: string, postId: string) {
    const r = await this.call<{ is_published?: boolean; permalink_url?: string }>(
      'GET',
      `/${encodeURIComponent(postId)}`,
      pageToken,
      { fields: 'is_published,permalink_url' },
    );
    return { published: r.is_published === true, permalink: r.permalink_url ?? null };
  }

  async igCreateContainer(token: string, igUserId: string, imageUrl: string, caption: string) {
    const r = await this.call<{ id: string }>('POST', `/${encodeURIComponent(igUserId)}/media`, token, {
      image_url: imageUrl,
      caption,
    });
    return r.id;
  }

  async igContainerStatus(token: string, containerId: string) {
    const r = await this.call<{ status_code: IgContainerStatus }>('GET', `/${encodeURIComponent(containerId)}`, token, {
      fields: 'status_code',
    });
    return r.status_code;
  }

  async igPublish(token: string, igUserId: string, containerId: string) {
    const r = await this.call<{ id: string }>('POST', `/${encodeURIComponent(igUserId)}/media_publish`, token, {
      creation_id: containerId,
    });
    return r.id;
  }

  async igPermalink(token: string, mediaId: string) {
    const r = await this.call<{ permalink?: string }>('GET', `/${encodeURIComponent(mediaId)}`, token, {
      fields: 'permalink',
    });
    return r.permalink ?? null;
  }

  /**
   * Renew an expiring token (only possible with the app id + secret). Returns
   * null when not configured. Meta keeps the old token valid until its own
   * expiry, so renewing early causes no downtime.
   */
  async exchangeToken(token: string) {
    if (!this.appId || !this.appSecret) return null;
    const r = await this.call<{ access_token: string; expires_in?: number }>('GET', '/oauth/access_token', null, {
      grant_type: 'fb_exchange_token',
      client_id: this.appId,
      client_secret: this.appSecret,
      fb_exchange_token: token,
      set_token_expires_in_60_days: 'true',
    });
    return {
      token: r.access_token,
      expiresAt: r.expires_in ? new Date(Date.now() + r.expires_in * 1000) : null,
    };
  }

  // ── Transport ────────────────────────────────────────────

  private async call<T = unknown>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    token: string | null,
    params: Record<string, string>,
  ): Promise<T> {
    const all = { ...params };
    if (token) {
      all.access_token = token;
      // Required when the app has "Require app secret" on; harmless otherwise.
      if (this.appSecret && !token.includes('|')) all.appsecret_proof = createHmac('sha256', this.appSecret).update(token).digest('hex');
    }
    const body = new URLSearchParams(all);
    const url = method === 'POST' ? `${this.base}${path}` : `${this.base}${path}?${body}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
        body: method === 'POST' ? body : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      // Network failure or timeout: the call may or may not have reached Meta.
      throw new GraphApiError({ httpStatus: 0, message: err instanceof Error ? err.message : String(err) });
    }

    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = null;
    }
    if (!res.ok || json?.error) {
      const e = json?.error ?? {};
      throw new GraphApiError({
        httpStatus: res.status,
        code: typeof e.code === 'number' ? e.code : undefined,
        subcode: typeof e.error_subcode === 'number' ? e.error_subcode : undefined,
        message: String(e.message ?? (text.slice(0, 200) || res.statusText)),
        isTransient: e.is_transient === true,
        userMessage: typeof e.error_user_msg === 'string' ? e.error_user_msg : undefined,
      });
    }
    return json as T;
  }
}

/** Comparable start of a caption (Meta may normalise whitespace). */
function captionKey(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 120);
}

interface RawPage {
  id: string;
  name: string;
  access_token?: string;
  instagram_business_account?: { id: string; username?: string };
}

function toPage(p: RawPage): PageInfo {
  return {
    id: p.id,
    name: p.name,
    accessToken: p.access_token,
    instagram: p.instagram_business_account
      ? { id: p.instagram_business_account.id, username: p.instagram_business_account.username }
      : null,
  };
}

/**
 * Stand-in used when SOCIAL_DRY_RUN=true: everything "succeeds" and is only
 * logged, so the whole pipeline can be tried locally without a Meta account.
 */
export class DryRunMetaApi implements MetaApi {
  readonly dryRun = true;
  private n = 0;
  constructor(private readonly log: (msg: string) => void) {}

  private id(prefix: string) {
    return `dry-${prefix}-${Date.now()}-${++this.n}`;
  }
  async inspectToken(): Promise<TokenInfo> {
    return { valid: true, expiresAt: null, scopes: ['pages_manage_posts', 'instagram_content_publish'] };
  }
  async listPages(): Promise<PageInfo[]> {
    return [{ id: 'dry-page', name: 'صفحة تجريبية', accessToken: 'dry', instagram: { id: 'dry-ig', username: 'dry_run' } }];
  }
  async getPage(_t: string, pageId: string): Promise<PageInfo> {
    return { id: pageId, name: 'صفحة تجريبية', accessToken: 'dry', instagram: { id: 'dry-ig', username: 'dry_run' } };
  }
  async postPhoto(_t: string, _p: string, imageUrl: string, caption: string, when: Date | null) {
    this.log(`[dry-run] Facebook ${when ? `scheduled for ${when.toISOString()}` : 'now'}: ${imageUrl}\n${caption}`);
    return this.id('fb');
  }
  async deletePost(_t: string, postId: string) {
    this.log(`[dry-run] Facebook delete ${postId}`);
  }
  async findPostByCaption() {
    return null;
  }
  async getPostState() {
    return { published: true, permalink: null };
  }
  async igCreateContainer(_t: string, _ig: string, imageUrl: string, caption: string) {
    this.log(`[dry-run] Instagram container: ${imageUrl}\n${caption}`);
    return this.id('container');
  }
  async igContainerStatus(): Promise<IgContainerStatus> {
    return 'FINISHED';
  }
  async igPublish(_t: string, _ig: string, containerId: string) {
    this.log(`[dry-run] Instagram publish ${containerId}`);
    return this.id('ig');
  }
  async igPermalink() {
    return null;
  }
  async exchangeToken() {
    return null;
  }
}
