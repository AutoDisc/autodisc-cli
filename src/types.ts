export type PlanType = 'free' | 'starter' | 'builder' | 'small' | 'premium';

export interface User {
  id: string;
  email: string;
  name?: string | null;
}

export interface AuthSession {
  token: string;
  refreshToken?: string;
  user: User;
  expiresAt?: string;
  receivedAt: string;
}

export interface CLIConfig {
  auth?: AuthSession;
  api: {
    url: string;
    timeout: number;
  };
  deploy: {
    currentServer?: string | null;
    defaultPlan: PlanType;
    autoConfirm: boolean;
  };
  ui: {
    colors: boolean;
    emoji: boolean;
    verbose: boolean;
  };
  telemetry: {
    enabled: boolean;
  };
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval?: number;
}

export interface DeviceTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in?: number;
  user?: User;
}

export interface RefreshSessionResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user?: User;
}

export interface BrowserCallbackPayload {
  token: string;
  refreshToken?: string;
  expiresIn?: number;
  user?: User;
}

export interface DeployConfig {
  version: string;
  name: string;
  description?: string;
  source: {
    type: 'upload' | 'repo';
    repo_full_name?: string;
    repo_branch?: string;
    path?: string;
  };
  runtime: {
    stack?: 'auto' | 'node' | 'python' | 'dockerfile';
    start_command?: string;
    image?: string;
    dockerfile?: string;
    workdir?: string;
    build_steps?: string[];
  };
  deployment: {
    plan_type: PlanType;
    auto_restart?: boolean;
  };
  environment?: Record<string, string>;
  secrets?: string[];
  ignore?: string[];
}

export interface HostingServerResponse {
  id: string;
  user_id: string;
  name: string;
  source_type: 'repo' | 'upload';
  repo_full_name?: string;
  repo_branch?: string;
  source_upload_key?: string;
  source_upload_name?: string;
  start_command?: string;
  detected_stack?: string;
  plan_type: PlanType;
  status: 'stopped' | 'running' | 'provisioning' | 'suspended' | 'error';
  status_reason?: string;
  cpu_limit?: number;
  memory_mb?: number;
  storage_mb?: number;
  auto_restart?: boolean;
  environment?: Record<string, string>;
  container_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface HostingProjectResponse {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  services: HostingServerResponse[];
  created_at?: string;
  updated_at?: string;
}

export interface HostingProjectsListResponse {
  projects: HostingProjectResponse[];
}

export interface HostingLogsResponse {
  logs: string;
}

export interface HostingStatsResponse {
  cpu_percent?: number | null;
  memory_percent?: number | null;
  memory_usage_mb?: number | null;
  memory_limit_mb?: number | null;
}

export interface HostingDeploymentResponse {
  id: string;
  server_id: string;
  status: string;
  commit_sha?: string | null;
  commit_message?: string | null;
  commit_author?: string | null;
  commit_url?: string | null;
  branch?: string | null;
  build_id?: string | null;
  trigger?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  error_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface HostingDeploymentsResponse {
  deployments: HostingDeploymentResponse[];
}

export interface HostingUploadResponse {
  upload_key: string;
  bucket: string;
  size_bytes: number;
}

export interface AgentConversationMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  created_at?: string;
}

export interface AgentState {
  conversationId: string;
  workspaceId?: string | null;
  projectId?: string | null;
  analysis?: ProjectAnalysis;
  lastMessage?: string;
  envVariables?: string[];
  updatedAt: string;
}

export interface ConversationResponse {
  id: string;
  title: string;
  project_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectAnalysis {
  rootDir: string;
  stacks: string[];
  hasDockerfile: boolean;
  hasPackageJson: boolean;
  hasRequirements: boolean;
  filesSample: string[];
  packageJson?: Record<string, unknown>;
  requirements?: string[];
  envVariables: string[];
  notes: string[];
}
