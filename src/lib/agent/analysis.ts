import fs from 'fs';
import path from 'path';
import { ProjectAnalysis } from '../../types.js';

const MAX_FILE_SAMPLES = 40;
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.autodisc',
  '.turbo',
  '.terraform',
]);

const ENV_FILES = ['.env', '.env.local', '.env.example', '.env.sample', '.env.dev'];

function safeReadFile(filePath: string) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function collectEnvVariables(projectRoot: string): string[] {
  const vars = new Set<string>();
  for (const filename of ENV_FILES) {
    const fullPath = path.join(projectRoot, filename);
    if (!fs.existsSync(fullPath)) continue;
    const content = safeReadFile(fullPath);
    if (!content) continue;
    content.split(/\r?\n/).forEach((line) => {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=/i);
      if (match) {
        vars.add(match[1]);
      }
    });
  }
  return Array.from(vars).sort();
}

function listFiles(projectRoot: string): string[] {
  const samples: string[] = [];

  function walk(current: string, depth: number) {
    if (samples.length >= MAX_FILE_SAMPLES || depth > 4) return;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (samples.length >= MAX_FILE_SAMPLES) break;
      if (entry.name.startsWith('.git')) continue;
      if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
      const relative = path.relative(projectRoot, path.join(current, entry.name)) || entry.name;
      samples.push(relative);
      if (entry.isDirectory()) {
        walk(path.join(current, entry.name), depth + 1);
      }
    }
  }

  walk(projectRoot, 0);
  return samples;
}

function detectStacks(projectRoot: string, hasPackageJson: boolean, hasRequirements: boolean, hasDockerfile: boolean, packageJson?: Record<string, unknown>) {
  const stacks = new Set<string>();
  if (hasDockerfile) stacks.add('dockerfile');
  if (hasPackageJson) stacks.add('node');
  if (hasRequirements) stacks.add('python');

  const deps = (packageJson?.dependencies || {}) as Record<string, string>;
  const devDeps = (packageJson?.devDependencies || {}) as Record<string, string>;
  const allDeps = { ...deps, ...devDeps };
  if (allDeps.next) stacks.add('nextjs');
  if (allDeps.express) stacks.add('express');
  if (allDeps['@nestjs/core']) stacks.add('nestjs');
  if (allDeps.fastify) stacks.add('fastify');

  return Array.from(stacks);
}

function parseRequirementsFile(projectRoot: string): string[] | undefined {
  const reqPath = path.join(projectRoot, 'requirements.txt');
  if (!fs.existsSync(reqPath)) return undefined;
  const content = safeReadFile(reqPath);
  if (!content) return undefined;
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

export function analyzeProject(projectRoot: string): ProjectAnalysis {
  const hasDockerfile = fs.existsSync(path.join(projectRoot, 'Dockerfile'));
  const hasPackageJson = fs.existsSync(path.join(projectRoot, 'package.json'));
  const hasRequirements = fs.existsSync(path.join(projectRoot, 'requirements.txt'));

  let packageJson: Record<string, unknown> | undefined;
  if (hasPackageJson) {
    const raw = safeReadFile(path.join(projectRoot, 'package.json'));
    if (raw) {
      try {
        packageJson = JSON.parse(raw);
      } catch {
        // ignore parse error
      }
    }
  }

  const requirements = parseRequirementsFile(projectRoot);
  const envVariables = collectEnvVariables(projectRoot);
  const filesSample = listFiles(projectRoot);
  const stacks = detectStacks(projectRoot, hasPackageJson, hasRequirements, hasDockerfile, packageJson);

  const notes: string[] = [];
  if (packageJson?.scripts && typeof packageJson.scripts === 'object') {
    const scripts = packageJson.scripts as Record<string, string>;
    if (scripts.build) notes.push(`Build script detected: ${scripts.build}`);
    if (scripts.start) notes.push(`Start script detected: ${scripts.start}`);
  }
  if (requirements?.some((item) => item.toLowerCase().includes('gunicorn'))) {
    notes.push('Gunicorn dependency detected (Python web server).');
  }
  if (stacks.includes('nextjs')) notes.push('Detected Next.js application.');

  return {
    rootDir: projectRoot,
    stacks,
    hasDockerfile,
    hasPackageJson,
    hasRequirements,
    filesSample,
    packageJson,
    requirements,
    envVariables,
    notes,
  };
}

export function formatAnalysisForPrompt(analysis: ProjectAnalysis): string {
  const lines = [
    `Stacks: ${analysis.stacks.length ? analysis.stacks.join(', ') : 'unknown'}`,
    `Dockerfile: ${analysis.hasDockerfile ? 'yes' : 'no'}`,
    `package.json: ${analysis.hasPackageJson ? 'yes' : 'no'}`,
    `requirements.txt: ${analysis.hasRequirements ? 'yes' : 'no'}`,
  ];

  if (analysis.packageJson?.scripts) {
    const scripts = analysis.packageJson.scripts as Record<string, string>;
    lines.push('Scripts:');
    Object.entries(scripts)
      .slice(0, 5)
      .forEach(([name, cmd]) => lines.push(`  - ${name}: ${cmd}`));
  }

  if (analysis.requirements && analysis.requirements.length) {
    lines.push('Python dependencies:');
    analysis.requirements.slice(0, 10).forEach((dep) => lines.push(`  - ${dep}`));
  }

  if (analysis.envVariables.length) {
    lines.push(`Environment variables detected (${analysis.envVariables.length}):`);
    analysis.envVariables.slice(0, 20).forEach((name) => lines.push(`  - ${name}`));
  }

  if (analysis.notes.length) {
    lines.push('Notes:');
    analysis.notes.forEach((note) => lines.push(`  - ${note}`));
  }

  lines.push('Sample files:');
  analysis.filesSample.slice(0, 20).forEach((file) => lines.push(`  - ${file}`));

  return lines.join('\n');
}
