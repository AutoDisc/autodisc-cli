import { createHttpClient } from '../../lib/http.js';

export type Bucket = {
  id: string;
  project_id: string;
  name: string;
  slug: string;
  region: string;
  status: string;
  endpoint?: string | null;
  logical_bytes: number;
  billable_bytes: number;
  object_count: number;
  storage_price_usd_per_gb_month: string | number;
  status_reason?: string | null;
  last_metered_at?: string | null;
};

export type BucketCredentials = {
  access_key_id: string;
  secret_access_key: string;
  endpoint: string;
  region: string;
  bucket: string;
  reveal: 'once';
};

export type BucketCreateResult = {
  bucket: Bucket;
  credentials: BucketCredentials | null;
  idempotent_replay: boolean;
};

export type BucketUsage = {
  logical_bytes: number;
  billable_bytes: number;
  object_count: number;
  included_gb_month: string | number;
  storage_price_usd_per_gb_month: string | number;
  last_metered_at?: string | null;
};

const path = (projectId: string) =>
  `/v1/projects/${encodeURIComponent(projectId)}/buckets`;

export class BucketsAPI {
  private readonly client = createHttpClient({ publicApi: true });

  list(projectId: string) {
    return this.client.get<Bucket[]>(path(projectId)).then(({ data }) => data);
  }

  get(projectId: string, bucketId: string) {
    return this.client
      .get<Bucket>(`${path(projectId)}/${encodeURIComponent(bucketId)}`)
      .then(({ data }) => data);
  }

  create(
    projectId: string,
    input: { name: string; region: string; idempotencyKey: string },
  ) {
    return this.client.post<BucketCreateResult>(path(projectId), {
      name: input.name,
      region: input.region,
      idempotency_key: input.idempotencyKey,
    }).then(({ data }) => data);
  }

  usage(projectId: string, bucketId: string) {
    return this.client
      .get<BucketUsage>(`${path(projectId)}/${encodeURIComponent(bucketId)}/usage`)
      .then(({ data }) => data);
  }

  delete(projectId: string, bucketId: string) {
    return this.client.delete(`${path(projectId)}/${encodeURIComponent(bucketId)}`);
  }
}
