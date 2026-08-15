import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

import { createHttpClient, extractAxiosError } from './http.js';

export interface AnonymousDeploymentResponse {
  drop_id: string;
  status: string;
  status_url: string;
  public_url?: string | null;
  expires_at: string;
  control_token: string;
  claim_url: string;
  limits: Record<string, number>;
}

export interface AnonymousDeployPayload {
  name: string;
  start_command?: string;
  setup_command?: string;
  port?: number;
  environment?: Record<string, string>;
}

export class AnonymousDeploymentsAPI {
  private client = createHttpClient({ includeAuth: false });

  async deployRepository(
    payload: AnonymousDeployPayload & { repository: string; branch?: string },
  ): Promise<AnonymousDeploymentResponse> {
    try {
      const response = await this.client.post<AnonymousDeploymentResponse>(
        '/v1/drops',
        {
          name: payload.name,
          source: {
            kind: 'github',
            url: payload.repository,
            ref: payload.branch,
          },
          lifetime_hours: 24,
          requested_mode: 'auto',
          start_command: payload.start_command,
          setup_command: payload.setup_command,
          port: payload.port,
          environment: payload.environment ?? {},
        },
      );
      return response.data;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }

  async deployUpload(
    filePath: string,
    payload: AnonymousDeployPayload,
  ): Promise<AnonymousDeploymentResponse> {
    const resolved = path.resolve(filePath);
    const form = new FormData();
    form.append('source', fs.createReadStream(resolved), path.basename(resolved));
    form.append('request', JSON.stringify({
      ...payload,
      lifetime_hours: 24,
      requested_mode: 'auto',
    }));
    try {
      const response = await this.client.post<AnonymousDeploymentResponse>(
        '/v1/drops/upload',
        form,
        {
          headers: form.getHeaders(),
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        },
      );
      return response.data;
    } catch (error) {
      throw new Error(extractAxiosError(error));
    }
  }
}
