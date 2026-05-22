import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';

/**
 * ReferralsProxyService
 *
 * Forwards SaaS-admin referral requests to the MAIN backend's internal
 * referral surface (/api/v1/internal/referrals/*), authenticating with the
 * shared x-internal-secret header.
 *
 * This keeps a single source of truth: the main backend owns all referral
 * tables. The SCC never reads referral data from its own DB.
 */
@Injectable()
export class ReferralsProxyService {
  private readonly logger = new Logger(ReferralsProxyService.name);
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    const baseURL = this.config.get<string>('MAIN_APP_API_URL', 'http://localhost:4000');
    const secret = this.config.get<string>('INTERNAL_API_SECRET', '');

    this.http = axios.create({
      baseURL: `${baseURL.replace(/\/$/, '')}/api/v1/internal/referrals`,
      timeout: 10_000,
      headers: { 'x-internal-secret': secret },
    });
  }

  // ── Read ─────────────────────────────────────────────────────────

  overview() {
    return this.get('/overview');
  }

  funnel(params: Record<string, unknown>) {
    return this.get('/analytics/funnel', params);
  }

  topReferrers(params: Record<string, unknown>) {
    return this.get('/analytics/top-referrers', params);
  }

  attributedRevenue(params: Record<string, unknown>) {
    return this.get('/analytics/attributed-revenue', params);
  }

  timeToReward(params: Record<string, unknown>) {
    return this.get('/analytics/time-to-reward', params);
  }

  walletAggregates() {
    return this.get('/analytics/wallet-aggregates');
  }

  dailyTrend(params: Record<string, unknown>) {
    return this.get('/analytics/daily-trend', params);
  }

  fraudQueue(params: Record<string, unknown>) {
    return this.get('/fraud-queue', params);
  }

  wallet(studioId: string) {
    return this.get(`/wallets/${studioId}`);
  }

  freezeWallet(studioId: string, body: { reason: string; actor_id: string }) {
    return this.post(`/wallets/${studioId}/freeze`, body);
  }

  unfreezeWallet(studioId: string, body: { actor_id: string }) {
    return this.post(`/wallets/${studioId}/unfreeze`, body);
  }

  manualAdjustment(body: {
    studio_id: string;
    amount: number;
    currency?: string;
    reason: string;
    actor_id: string;
  }) {
    return this.post('/wallets/manual-adjustment', body);
  }

  // ── Write ────────────────────────────────────────────────────────

  reviewSignal(
    signalId: string,
    body: { decision: 'reviewed_ok' | 'confirmed_fraud'; notes?: string; actor_id: string },
  ) {
    return this.post(`/fraud-signals/${signalId}/review`, body);
  }

  // ── Plans (for rule condition builder) ───────────────────────────

  listPlans() {
    return this.get('/plans');
  }

  // ── Reward rules CRUD ────────────────────────────────────────────

  listRules(campaignId?: string) {
    return this.get('/rules', campaignId ? { campaign_id: campaignId } : undefined);
  }

  getRule(id: string) {
    return this.get(`/rules/${id}`);
  }

  createRule(body: unknown) {
    return this.post('/rules', body);
  }

  updateRule(id: string, body: unknown) {
    return this.patch(`/rules/${id}`, body);
  }

  deleteRule(id: string) {
    return this.delete(`/rules/${id}`);
  }

  // ── Campaigns ────────────────────────────────────────────────────

  listCampaigns() {
    return this.get('/campaigns');
  }

  createCampaign(body: unknown) {
    return this.post('/campaigns', body);
  }

  // ── HTTP helpers ─────────────────────────────────────────────────

  private async get(path: string, params?: Record<string, unknown>) {
    try {
      const res = await this.http.get(path, { params });
      return res.data;
    } catch (err) {
      throw this.translate(err as AxiosError, `GET ${path}`);
    }
  }

  private async post(path: string, body: unknown) {
    try {
      const res = await this.http.post(path, body);
      return res.data;
    } catch (err) {
      throw this.translate(err as AxiosError, `POST ${path}`);
    }
  }

  private async patch(path: string, body: unknown) {
    try {
      const res = await this.http.patch(path, body);
      return res.data;
    } catch (err) {
      throw this.translate(err as AxiosError, `PATCH ${path}`);
    }
  }

  private async delete(path: string) {
    try {
      const res = await this.http.delete(path);
      return res.data;
    } catch (err) {
      throw this.translate(err as AxiosError, `DELETE ${path}`);
    }
  }

  private translate(err: AxiosError, ctx: string): HttpException {
    if (err.response) {
      const status = err.response.status;
      const data = err.response.data as any;
      this.logger.warn(`${ctx} → ${status}: ${JSON.stringify(data)}`);
      return new HttpException(
        data?.message ?? data ?? 'Upstream error',
        status,
      );
    }
    // Network / timeout — main backend unreachable.
    this.logger.error(`${ctx} → unreachable: ${err.message}`);
    return new ServiceUnavailableException('Referral service is unreachable');
  }
}
