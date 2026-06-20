import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { createHttpClient, extractAxiosError } from './http.js';
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
  plan_type?: string;
  environment?: Record<string, string>;
  auto_restart?: boolean;
}

export class HostingAPI {
  private client = createHttpClient();

  async getServer(): Promise<HostingServerResponse | null> {
    try {
      const { data } = await this.client.get<HostingServerResponse>('/hosting/server');
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

  async startServer(): Promise<HostingServerResponse> {
    try {
      const { data } = await this.client.post<HostingServerResponse>('/hosting/server/start');
      return data;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async stopServer(): Promise<HostingServerResponse> {
    try {
      const { data } = await this.client.post<HostingServerResponse>('/hosting/server/stop');
      return data;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async redeployServer(): Promise<HostingServerResponse> {
    try {
      const { data } = await this.client.post<HostingServerResponse>('/hosting/server/redeploy');
      return data;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async deleteServer(): Promise<HostingServerResponse> {
    try {
      const { data } = await this.client.delete<HostingServerResponse>('/hosting/server');
      return data;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async fetchLogs(tail = 200): Promise<HostingLogsResponse> {
    try {
      const { data } = await this.client.get<HostingLogsResponse>('/hosting/server/logs', {
        params: { tail },
      });
      return data;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async fetchServerLogs(tail = 200, serverId?: string): Promise<HostingLogsResponse> {
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

  async fetchStats(serverId?: string): Promise<HostingStatsResponse> {
    try {
      const { data } = await this.client.get<HostingStatsResponse>('/hosting/server/stats', {
        params: serverId ? { server_id: serverId } : undefined,
      });
      return data;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async listDeployments(limit = 20, serverId?: string): Promise<HostingDeploymentResponse[]> {
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

  private buildPayloadFromServer(server: HostingServerResponse): UpsertServerPayload {
    return {
      name: server.name,
      source_type: server.source_type,
      repo_full_name: server.repo_full_name,
      repo_branch: server.repo_branch,
      source_upload_key: server.source_upload_key,
      source_upload_name: server.source_upload_name,
      start_command: server.start_command,
      plan_type: server.plan_type,
      environment: server.environment || {},
      auto_restart: server.auto_restart,
    };
  }

  async updateEnvironment(environment: Record<string, string>): Promise<HostingServerResponse> {
    const server = await this.requireServer();
    const payload = this.buildPayloadFromServer(server);
    payload.environment = environment;
    return this.upsertServer(payload);
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
}
