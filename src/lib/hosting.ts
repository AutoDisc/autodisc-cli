import axios from 'axios';
import { setTimeout as sleep } from 'node:timers/promises';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { createHttpClient, extractAxiosError } from './http.js';
import { getConfigManager } from './config.js';
import type {
  HostingLogsResponse,
  HostingDeploymentsResponse,
  HostingDeploymentResponse,
  HostingProjectResponse,
  HostingProjectsListResponse,
  HostingServerResponse,
  HostingStatsResponse,
  HostingUploadResponse,
} from '../types.js';

export interface UpsertServerPayload {
  name: string;
  source_type: 'repo' | 'upload';
  repo_full_name?: string;
  repo_branch?: string;
  source_upload_key?: string;
  source_upload_name?: string;
  start_command?: string;
  setup_command?: string;
  detected_stack?: string;
  plan_type?: string;
  environment?: Record<string, string>;
  auto_restart?: boolean;
  service_type?: 'app' | 'worker' | 'postgres' | 'redis' | 'cron';
  service_name?: string;
  depends_on?: string[];
  internal?: boolean;
  port?: number;
  show_url?: boolean;
}

export interface DeployBundlePayload {
  upload_key: string;
  upload_name?: string;
  start_command?: string;
  setup_command?: string;
  detected_stack?: string;
  environment?: Record<string, string>;
  auto_restart?: boolean;
  start?: boolean;
}

export function redactServerEnvironment(server: HostingServerResponse): HostingServerResponse {
  if (!server.environment) return server;
  return {
    ...server,
    environment: Object.fromEntries(Object.keys(server.environment).map((key) => [key, '[hidden]'])),
  };
}

export class HostingAPI {
  private client = createHttpClient();

  private async actionWithRetry<T>(request: () => Promise<{ data: T }>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return (await request()).data;
      } catch (error) {
        lastError = error;
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        const transient = axios.isAxiosError(error) && (!error.response || (status !== undefined && status >= 500));
        if (!transient || attempt === 3) break;
        await sleep(attempt * 500);
      }
    }
    throw lastError;
  }

  private configuredServerId(): string | undefined {
    return getConfigManager().getValue<string>('deploy.currentServer') || undefined;
  }

  async getServer(serverId = this.configuredServerId()): Promise<HostingServerResponse | null> {
    try {
      const { data } = await this.client.get<HostingServerResponse>('/hosting/server', {
        params: serverId ? { server_id: serverId } : undefined,
      });
      return data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw new Error(extractAxiosError(error));
    }
  }

  async upsertServer(payload: UpsertServerPayload): Promise<HostingServerResponse> {
    try {
      const { data } = await this.client.post<HostingServerResponse>('/hosting/server', payload);
      return data;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async startServer(serverId = this.configuredServerId()): Promise<HostingServerResponse> {
    try {
      return await this.actionWithRetry(() => this.client.post<HostingServerResponse>(
        '/hosting/server/start',
        undefined,
        { params: serverId ? { server_id: serverId } : undefined }
      ));
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async stopServer(serverId = this.configuredServerId()): Promise<HostingServerResponse> {
    try {
      return await this.actionWithRetry(() => this.client.post<HostingServerResponse>(
        '/hosting/server/stop',
        undefined,
        { params: serverId ? { server_id: serverId } : undefined }
      ));
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async redeployServer(serverId = this.configuredServerId()): Promise<HostingServerResponse> {
    try {
      return await this.actionWithRetry(() => this.client.post<HostingServerResponse>(
        '/hosting/server/redeploy',
        undefined,
        { params: serverId ? { server_id: serverId } : undefined }
      ));
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async deleteServer(serverId = this.configuredServerId()): Promise<HostingServerResponse> {
    try {
      const { data } = await this.client.delete<HostingServerResponse>('/hosting/server', {
        params: serverId ? { server_id: serverId } : undefined,
      });
      return data;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async fetchLogs(tail = 200, serverId = this.configuredServerId()): Promise<HostingLogsResponse> {
    try {
      const { data } = await this.client.get<HostingLogsResponse>('/hosting/server/logs', {
        params: { tail, ...(serverId ? { server_id: serverId } : {}) },
      });
      return data;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async fetchServerLogs(tail = 200, serverId = this.configuredServerId()): Promise<HostingLogsResponse> {
    try {
      const { data } = await this.client.get<HostingLogsResponse>('/hosting/server/logs', {
        params: {
          tail,
          ...(serverId ? { server_id: serverId } : {}),
        },
      });
      return data;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async fetchStats(serverId = this.configuredServerId()): Promise<HostingStatsResponse> {
    try {
      const { data } = await this.client.get<HostingStatsResponse>('/hosting/server/stats', {
        params: serverId ? { server_id: serverId } : undefined,
      });
      return data;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async listDeployments(limit = 20, serverId = this.configuredServerId()): Promise<HostingDeploymentResponse[]> {
    try {
      const { data } = await this.client.get<HostingDeploymentsResponse>('/hosting/server/deployments', {
        params: {
          limit,
          ...(serverId ? { server_id: serverId } : {}),
        },
      });
      return data.deployments;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async listProjects(): Promise<HostingProjectResponse[]> {
    try {
      const { data } = await this.client.get<HostingProjectsListResponse>('/hosting/projects');
      return data.projects;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async createProject(name: string): Promise<HostingProjectResponse> {
    try {
      const { data } = await this.client.post<HostingProjectResponse>('/hosting/projects', { name });
      return data;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async getProject(projectId: string): Promise<HostingProjectResponse> {
    try {
      const { data } = await this.client.get<HostingProjectResponse>(`/hosting/projects/${projectId}`);
      return data;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async addProjectService(
    projectId: string,
    payload: UpsertServerPayload,
    environmentId?: string | null,
  ): Promise<HostingServerResponse> {
    try {
      const endpoint = environmentId
        ? `/hosting/projects/${projectId}/environments/${environmentId}/services`
        : `/hosting/projects/${projectId}/services`;
      const { data } = await this.client.post<HostingServerResponse>(
        endpoint,
        payload
      );
      return data;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async updateServer(serverId: string, payload: Partial<UpsertServerPayload>): Promise<HostingServerResponse> {
    try {
      const { data } = await this.client.patch<HostingServerResponse>(
        '/hosting/server',
        payload,
        { params: { server_id: serverId } }
      );
      return data;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async deployProject(projectId: string): Promise<Record<string, unknown>> {
    try {
      const { data } = await this.client.post<Record<string, unknown>>(`/hosting/projects/${projectId}/deploy`);
      return data;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async stopProject(projectId: string): Promise<Record<string, unknown>> {
    try {
      const { data } = await this.client.post<Record<string, unknown>>(`/hosting/projects/${projectId}/stop`);
      return data;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async redeployProject(projectId: string): Promise<Record<string, unknown>> {
    try {
      const { data } = await this.client.post<Record<string, unknown>>(`/hosting/projects/${projectId}/redeploy`);
      return data;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async deleteProject(projectId: string): Promise<HostingProjectResponse> {
    try {
      const { data } = await this.client.delete<HostingProjectResponse>(`/hosting/projects/${projectId}`);
      return data;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async listRepos() {
    try {
      const { data } = await this.client.get('/hosting/repos');
      return data;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  private async requireServer(): Promise<HostingServerResponse> {
    const server = await this.getServer();
    if (!server) {
      throw new Error('No hosting server found. Run "autodisc deploy" first.');
    }
    return server;
  }

  async updateEnvironment(environment: Record<string, string>): Promise<HostingServerResponse> {
    const server = await this.requireServer();
    try {
      const { data } = await this.client.patch<HostingServerResponse>(
        '/hosting/server',
        { environment },
        { params: { server_id: server.id } }
      );
      return data;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async getEnvironment(): Promise<Record<string, string>> {
    const server = await this.requireServer();
    return server.environment || {};
  }

  async uploadBundle(filePath: string): Promise<HostingUploadResponse> {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Bundle not found: ${resolved}`);
    }

    const stats = fs.statSync(resolved);
    if (!stats.isFile()) {
      throw new Error('Upload path must be a file (.zip).');
    }

    const stream = fs.createReadStream(resolved);
    const form = new FormData();
    form.append('file', stream, path.basename(resolved));

    try {
      const { data } = await this.client.post<HostingUploadResponse>('/hosting/uploads', form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      return data;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async deployBundle(serverId: string, payload: DeployBundlePayload): Promise<HostingServerResponse> {
    try {
      return await this.actionWithRetry(() => this.client.post<HostingServerResponse>(
        '/hosting/server/deploy',
        payload,
        { params: { server_id: serverId } }
      ));
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }
}
