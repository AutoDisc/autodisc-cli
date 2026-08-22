import { createHttpClient } from '../../lib/http.js';

export type ServerRegion = {
  code: string;
  name: string;
};

export type ServerShape = {
  id: string;
  code: string;
  name: string;
  vcpu_count: string | number;
  memory_mb: number;
  architecture: 'arm64' | 'amd64';
};

export type Server = {
  id: string;
  account_id: string;
  project_ids: string[];
  name: string;
  slug: string;
  region: string;
  shape_id?: string | null;
  image_code: string;
  architecture: 'arm64' | 'amd64';
  vcpu_count: string | number;
  memory_mb: number;
  status: string;
  desired_state: string;
  quota_behavior: string;
  public_ipv4_enabled: boolean;
  status_reason?: string | null;
  created_at: string;
  updated_at: string;
  network_interfaces?: Array<{
    id: string;
    network_scope: 'public' | 'private';
    address_family: 4 | 6;
    address?: string | null;
    status: string;
  }>;
  lifecycle_operations?: Array<{
    id: string;
    operation: string;
    status: string;
    error_code?: string | null;
    error_message?: string | null;
    created_at: string;
  }>;
};

export type ServerQuote = {
  id: string;
  token: string;
  region: string;
  shape_code: string;
  vcpu_count: string | number;
  memory_mb: number;
  storage_gb: string | number;
  public_ipv4_enabled: boolean;
  quota_behavior: 'stop' | 'use_overage';
  running_rate_usd_per_hour: string | number;
  stopped_rate_usd_per_hour: string | number;
  running_price_usd_per_730_hours: string | number;
  available_credit_usd: string | number;
  expires_at: string;
};

export type ServerMutation = {
  server: Server;
  operation: {
    id: string;
    server_id: string;
    operation: string;
    status: string;
    error_code?: string | null;
    error_message?: string | null;
  };
  idempotent_replay: boolean;
};

export class ServersAPI {
  private readonly client = createHttpClient({ publicApi: true });

  listRegions() {
    return this.client.get<ServerRegion[]>('/servers/regions').then(({ data }) => data);
  }

  listShapes() {
    return this.client.get<ServerShape[]>('/servers/shapes').then(({ data }) => data);
  }

  list(projectId: string) {
    return this.client
      .get<Server[]>(`/v1/projects/${encodeURIComponent(projectId)}/servers`)
      .then(({ data }) => data);
  }

  get(projectId: string, serverId: string) {
    return this.client
      .get<Server>(
        `/v1/projects/${encodeURIComponent(projectId)}/servers/${encodeURIComponent(serverId)}`,
      )
      .then(({ data }) => data);
  }

  quote(
    projectId: string,
    input: {
      region: string;
      shapeCode: string;
      storageGb: number;
      publicIpv4Enabled: boolean;
      quotaBehavior: 'stop' | 'use_overage';
    },
  ) {
    return this.client
      .post<ServerQuote>(
        `/v1/projects/${encodeURIComponent(projectId)}/servers/quotes`,
        {
          region: input.region,
          shape_code: input.shapeCode,
          storage_gb: input.storageGb,
          public_ipv4_enabled: input.publicIpv4Enabled,
          quota_behavior: input.quotaBehavior,
        },
      )
      .then(({ data }) => data);
  }

  create(
    projectId: string,
    input: { name: string; quoteToken: string; idempotencyKey: string },
  ) {
    return this.client
      .post<ServerMutation>(`/v1/projects/${encodeURIComponent(projectId)}/servers`, {
        name: input.name,
        quote_token: input.quoteToken,
        idempotency_key: input.idempotencyKey,
        image_code: 'autodisc-linux',
      })
      .then(({ data }) => data);
  }

  lifecycle(
    projectId: string,
    serverId: string,
    action: 'start' | 'stop' | 'restart' | 'delete',
    idempotencyKey: string,
  ) {
    return this.client
      .post<ServerMutation>(
        `/v1/projects/${encodeURIComponent(projectId)}/servers/${encodeURIComponent(serverId)}/lifecycle`,
        { action, idempotency_key: idempotencyKey },
      )
      .then(({ data }) => data);
  }
}
