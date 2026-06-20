import fs from 'fs';
import path from 'path';
import boxen from 'boxen';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { DeployConfig, ProjectAnalysis } from '../types.js';
import { analyzeProject } from './agent/analysis.js';
import { logger } from './logger.js';
import { confirm } from './prompts.js';
import { createSpinner } from './spinner.js';
import { createAgentConversation, streamAgentChat } from './agent/backend.js';
import { saveDeployConfig } from './deploy-config.js';

export type DetectionConfidence = 'high' | 'medium' | 'low';

export interface AutoConfigResult {
  config: DeployConfig;
  confidence: DetectionConfidence;
  detectedEntryPoint?: string;
  detectedStack: string;
  notes: string[];
}

interface EntryPointCandidate {
  file: string;
  command: string;
  priority: number;
}

const PYTHON_ENTRY_POINTS = [
  { pattern: 'bot.py', priority: 10 },
  { pattern: 'main.py', priority: 9 },
  { pattern: 'app.py', priority: 8 },
  { pattern: 'run.py', priority: 7 },
  { pattern: 'index.py', priority: 6 },
  { pattern: 'server.py', priority: 5 },
  { pattern: '__main__.py', priority: 4 },
  { pattern: 'src/main.py', priority: 3 },
  { pattern: 'src/bot.py', priority: 3 },
  { pattern: 'src/app.py', priority: 2 },
];

const NODE_ENTRY_POINTS = [
  { pattern: 'index.js', priority: 10 },
  { pattern: 'bot.js', priority: 9 },
  { pattern: 'main.js', priority: 8 },
  { pattern: 'app.js', priority: 7 },
  { pattern: 'server.js', priority: 6 },
  { pattern: 'src/index.js', priority: 5 },
  { pattern: 'src/bot.js', priority: 4 },
  { pattern: 'src/main.js', priority: 3 },
  { pattern: 'dist/index.js', priority: 2 },
  { pattern: 'dist/main.js', priority: 1 },
];

const TS_ENTRY_POINTS = [
  { pattern: 'index.ts', priority: 10 },
  { pattern: 'bot.ts', priority: 9 },
  { pattern: 'main.ts', priority: 8 },
  { pattern: 'app.ts', priority: 7 },
  { pattern: 'server.ts', priority: 6 },
  { pattern: 'src/index.ts', priority: 5 },
  { pattern: 'src/bot.ts', priority: 4 },
  { pattern: 'src/main.ts', priority: 3 },
];

function findPythonEntryPoint(projectRoot: string, files: string[]): EntryPointCandidate | null {
  const candidates: EntryPointCandidate[] = [];

  for (const entry of PYTHON_ENTRY_POINTS) {
    if (files.includes(entry.pattern) || fs.existsSync(path.join(projectRoot, entry.pattern))) {
      candidates.push({
        file: entry.pattern,
        command: `python ${entry.pattern}`,
        priority: entry.priority,
      });
    }
  }

  // Check for Discord bot patterns in Python files
  for (const file of files) {
    if (!file.endsWith('.py')) continue;
    const fullPath = path.join(projectRoot, file);
    if (!fs.existsSync(fullPath)) continue;
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      // Look for Discord bot patterns
      if (content.includes('discord.Client') || content.includes('commands.Bot') || content.includes('discord.Bot')) {
        const existing = candidates.find((c) => c.file === file);
        if (existing) {
          existing.priority += 5; // Boost priority for Discord bot files
        } else {
          candidates.push({
            file,
            command: `python ${file}`,
            priority: 8,
          });
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);
  return candidates[0] ?? null;
}

function findNodeEntryPoint(
  projectRoot: string,
  files: string[],
  packageJson?: Record<string, unknown>
): EntryPointCandidate | null {
  const candidates: EntryPointCandidate[] = [];

  // Check package.json scripts first (highest priority)
  if (packageJson?.scripts && typeof packageJson.scripts === 'object') {
    const scripts = packageJson.scripts as Record<string, string>;
    if (scripts.start) {
      return {
        file: 'package.json:start',
        command: 'npm start',
        priority: 100,
      };
    }
  }

  // Check package.json main field
  if (packageJson?.main && typeof packageJson.main === 'string') {
    const mainFile = packageJson.main;
    if (fs.existsSync(path.join(projectRoot, mainFile))) {
      candidates.push({
        file: mainFile,
        command: `node ${mainFile}`,
        priority: 15,
      });
    }
  }

  // Check for TypeScript (needs build step)
  const hasTypeScript = files.some((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'));
  const hasTsConfig = fs.existsSync(path.join(projectRoot, 'tsconfig.json'));

  if (hasTypeScript && hasTsConfig) {
    // Look for TS entry points
    for (const entry of TS_ENTRY_POINTS) {
      if (files.includes(entry.pattern) || fs.existsSync(path.join(projectRoot, entry.pattern))) {
        // For TS, we need to compile first
        const jsFile = entry.pattern.replace('.ts', '.js').replace('src/', 'dist/');
        candidates.push({
          file: entry.pattern,
          command: `node ${jsFile}`,
          priority: entry.priority,
        });
      }
    }
  }

  // Check standard JS entry points
  for (const entry of NODE_ENTRY_POINTS) {
    if (files.includes(entry.pattern) || fs.existsSync(path.join(projectRoot, entry.pattern))) {
      candidates.push({
        file: entry.pattern,
        command: `node ${entry.pattern}`,
        priority: entry.priority,
      });
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);
  return candidates[0] ?? null;
}

function detectBuildSteps(analysis: ProjectAnalysis): string[] {
  const steps: string[] = [];

  if (analysis.hasPackageJson && analysis.packageJson) {
    steps.push('npm install');

    const scripts = analysis.packageJson.scripts as Record<string, string> | undefined;
    if (scripts?.build) {
      steps.push('npm run build');
    }
  }

  if (analysis.hasRequirements) {
    steps.push('pip install -r requirements.txt');
  }

  return steps;
}

function generateProjectName(projectRoot: string): string {
  const dirName = path.basename(projectRoot);
  // Sanitize: lowercase, replace spaces and special chars with dashes
  return dirName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'my-bot';
}

export function detectConfig(projectRoot: string): AutoConfigResult {
  const analysis = analyzeProject(projectRoot);
  const notes: string[] = [];
  let confidence: DetectionConfidence = 'high';
  let detectedStack = 'auto';
  let startCommand: string | undefined;
  let detectedEntryPoint: string | undefined;
  const buildSteps = detectBuildSteps(analysis);

  // Dockerfile takes precedence
  if (analysis.hasDockerfile) {
    detectedStack = 'dockerfile';
    notes.push('Dockerfile detected - will use Docker build');
    return {
      config: createConfig(projectRoot, detectedStack, undefined, buildSteps, analysis),
      confidence: 'high',
      detectedStack,
      notes,
    };
  }

  // Python project
  if (analysis.hasRequirements || analysis.stacks.includes('python')) {
    detectedStack = 'python';
    const entry = findPythonEntryPoint(projectRoot, analysis.filesSample);
    if (entry) {
      startCommand = entry.command;
      detectedEntryPoint = entry.file;
      notes.push(`Detected Python entry point: ${entry.file}`);
    } else {
      confidence = 'low';
      notes.push('Python project detected but no clear entry point found');
    }
  }
  // Node.js project
  else if (analysis.hasPackageJson || analysis.stacks.includes('node')) {
    detectedStack = 'node';
    const entry = findNodeEntryPoint(projectRoot, analysis.filesSample, analysis.packageJson);
    if (entry) {
      startCommand = entry.command;
      detectedEntryPoint = entry.file;
      notes.push(`Detected Node.js entry point: ${entry.file}`);
      if (entry.file === 'package.json:start') {
        notes.push('Using npm start from package.json scripts');
      }
    } else {
      confidence = 'low';
      notes.push('Node.js project detected but no clear entry point found');
    }
  }
  // Unknown stack
  else {
    confidence = 'low';
    notes.push('Could not determine project type');
  }

  // Downgrade confidence if multiple potential entry points
  const pythonFiles = analysis.filesSample.filter((f) => f.endsWith('.py') && !f.includes('/'));
  const jsFiles = analysis.filesSample.filter((f) => (f.endsWith('.js') || f.endsWith('.ts')) && !f.includes('/'));
  if ((detectedStack === 'python' && pythonFiles.length > 3) || (detectedStack === 'node' && jsFiles.length > 5)) {
    if (confidence === 'high') confidence = 'medium';
    notes.push('Multiple potential entry points detected');
  }

  return {
    config: createConfig(projectRoot, detectedStack, startCommand, buildSteps, analysis),
    confidence,
    detectedEntryPoint,
    detectedStack,
    notes,
  };
}

function createConfig(
  projectRoot: string,
  stack: string,
  startCommand: string | undefined,
  buildSteps: string[],
  analysis: ProjectAnalysis
): DeployConfig {
  const config: DeployConfig = {
    version: '1',
    name: generateProjectName(projectRoot),
    source: {
      type: 'upload',
    },
    runtime: {
      stack: stack as 'auto' | 'node' | 'python' | 'dockerfile',
      start_command: startCommand,
      build_steps: buildSteps.length > 0 ? buildSteps : undefined,
    },
    deployment: {
      plan_type: 'builder',
      auto_restart: true,
    },
  };

  // Add detected environment variables as secrets
  if (analysis.envVariables.length > 0) {
    config.secrets = analysis.envVariables.filter((v) =>
      /^(TOKEN|SECRET|KEY|PASSWORD|API_|DATABASE_|DB_|DISCORD_|AUTH_)/i.test(v)
    );
  }

  return config;
}

export function formatConfigPreview(result: AutoConfigResult): string {
  const { config, confidence, detectedEntryPoint, notes } = result;

  const confidenceColor =
    confidence === 'high' ? chalk.green : confidence === 'medium' ? chalk.yellow : chalk.red;
  const confidenceIcon = confidence === 'high' ? '✓' : confidence === 'medium' ? '?' : '!';

  const lines = [
    `${chalk.bold('Project:')} ${config.name}`,
    `${chalk.bold('Stack:')} ${config.runtime.stack}`,
    `${chalk.bold('Start:')} ${config.runtime.start_command ?? chalk.dim('(not set)')}`,
    `${chalk.bold('Confidence:')} ${confidenceColor(`${confidenceIcon} ${confidence}`)}`,
  ];

  if (detectedEntryPoint) {
    lines.push(`${chalk.bold('Entry:')} ${detectedEntryPoint}`);
  }

  if (config.runtime.build_steps?.length) {
    lines.push(`${chalk.bold('Build:')} ${config.runtime.build_steps.join(' && ')}`);
  }

  if (notes.length > 0) {
    lines.push('');
    lines.push(chalk.dim('Notes:'));
    notes.forEach((note) => lines.push(chalk.dim(`  • ${note}`)));
  }

  return boxen(lines.join('\n'), {
    padding: 1,
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
    borderStyle: 'round',
    borderColor: confidence === 'high' ? 'green' : confidence === 'medium' ? 'yellow' : 'red',
  });
}

export async function runAIFallback(projectRoot: string, analysis: ProjectAnalysis): Promise<AutoConfigResult | null> {
  const spinner = createSpinner('Running deeper config analysis');
  spinner.start();

  try {
    const conversation = await createAgentConversation({ title: 'CLI Auto-Config' });

    const prompt = `Analyze this project and generate a deployment configuration.

Project Analysis:
${JSON.stringify(analysis, null, 2)}

Files in project:
${analysis.filesSample.join('\n')}

IMPORTANT: Identify the CORRECT entry point file. Look for:
- Discord bot files (files importing discord.py, discord.js, etc.)
- Main application entry points
- The actual file that starts the application

Return ONLY a valid YAML code block with the deployment config. No explanation needed.
The start_command must point to an ACTUAL file that EXISTS in the project.`;

    let yamlContent = '';

    await streamAgentChat({
      conversationId: conversation.id,
      message: prompt,
      onEvent: (event) => {
        if (event.type === 'text' && typeof event.content === 'string') {
          yamlContent += event.content;
        }
      },
    });

    spinner.succeed('AI analysis complete');

    // Extract YAML from response
    const yamlMatch = yamlContent.match(/```ya?ml\n([\s\S]*?)\n```/);
    if (!yamlMatch) {
      logger.warn('Deeper analysis did not return a valid configuration');
      return null;
    }

    const parsed = yaml.load(yamlMatch[1]) as DeployConfig;
    if (!parsed || !parsed.runtime?.start_command) {
      logger.warn('Deeper analysis returned an incomplete configuration');
      return null;
    }

    return {
      config: {
        ...parsed,
        version: '1',
        source: { type: 'upload' },
        deployment: parsed.deployment ?? { plan_type: 'builder', auto_restart: true },
      },
      confidence: 'high',
      detectedStack: parsed.runtime.stack ?? 'auto',
      notes: ['Configuration generated by deeper analysis'],
    };
  } catch (error) {
    spinner.fail('Deeper config analysis failed');
    logger.debug(`Deeper analysis error: ${error}`);
    return null;
  }
}

export async function resolveAutoConfig(projectRoot: string): Promise<AutoConfigResult | null> {
  const spinner = createSpinner('Detecting project configuration');
  spinner.start();

  let result = detectConfig(projectRoot);
  spinner.succeed('Project analyzed');

  if (result.confidence === 'low') {
    logger.warn('Low confidence in detected configuration');
    const shouldTryDeeperAnalysis = await confirm('Try a deeper config analysis?', true);
    if (shouldTryDeeperAnalysis) {
      const analysis = analyzeProject(projectRoot);
      const aiResult = await runAIFallback(projectRoot, analysis);
      if (aiResult) {
        result = aiResult;
      }
    }
  }

  return result;
}

export async function autoConfigWithPreview(projectRoot: string): Promise<DeployConfig | null> {
  const result = await resolveAutoConfig(projectRoot);
  if (!result) {
    return null;
  }

  console.log('\n' + formatConfigPreview(result) + '\n');

  if (!result.config.runtime.start_command) {
    logger.error('Could not determine start command for your project');
    logger.info('Please edit autodisc.yml manually or re-run: autodisc init');
    return null;
  }

  const shouldDeploy = await confirm('Deploy with this configuration?', true);
  if (!shouldDeploy) {
    logger.info('Deployment cancelled');
    return null;
  }

  return result.config;
}
