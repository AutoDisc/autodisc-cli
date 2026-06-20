import fs from 'fs';
import path from 'path';
import { AgentState } from '../../types.js';

const AUTODISC_DIR = '.autodisc';
const STATE_FILENAME = 'agent.json';

function getAutodiscDir(projectRoot: string) {
  return path.join(projectRoot, AUTODISC_DIR);
}

function getStatePath(projectRoot: string) {
  return path.join(getAutodiscDir(projectRoot), STATE_FILENAME);
}

export function ensureAutodiscDir(projectRoot: string) {
  fs.mkdirSync(getAutodiscDir(projectRoot), { recursive: true });
}

export function loadAgentState(projectRoot: string): AgentState | null {
  try {
    const statePath = getStatePath(projectRoot);
    if (!fs.existsSync(statePath)) {
      return null;
    }
    const raw = fs.readFileSync(statePath, 'utf8');
    return JSON.parse(raw) as AgentState;
  } catch (error) {
    console.warn('[agent] Failed to load agent state:', (error as Error).message);
    return null;
  }
}

export function saveAgentState(projectRoot: string, state: AgentState) {
  ensureAutodiscDir(projectRoot);
  const statePath = getStatePath(projectRoot);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

export function clearAgentState(projectRoot: string) {
  const statePath = getStatePath(projectRoot);
  if (fs.existsSync(statePath)) {
    fs.unlinkSync(statePath);
  }
}
