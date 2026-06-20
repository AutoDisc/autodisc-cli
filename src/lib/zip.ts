import archiver from 'archiver';
import fs from 'fs';
import { mkdtempSync } from 'fs';
import os from 'os';
import path from 'path';

const DEFAULT_IGNORES = [
  'node_modules/**',
  '.git/**',
  '.env',
  '.env.*',
  '*.log',
  '.DS_Store',
  'dist/**',
  'build/**',
  '__pycache__/**',
  '*.pyc',
  '.venv/**',
  'venv/**',
  '.next/**',
  'coverage/**',
  '.autodisc/secrets',
];

export interface ZipOptions {
  projectRoot: string;
  ignore?: string[];
}

export interface ZipResult {
  path: string;
  size: number;
  cleanup: () => void;
}

export async function createDeploymentZip(options: ZipOptions): Promise<ZipResult> {
  const projectRoot = path.resolve(options.projectRoot);
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'autodisc-'));
  const archivePath = path.join(tempDir, 'deploy.zip');
  const output = fs.createWriteStream(archivePath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  const ignorePatterns = [...DEFAULT_IGNORES, ...(options.ignore ?? [])];

  return new Promise<ZipResult>((resolve, reject) => {
    output.on('close', () => {
      resolve({
        path: archivePath,
        size: archive.pointer(),
        cleanup: () => {
          try {
            fs.unlinkSync(archivePath);
            fs.rmdirSync(tempDir);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
              // ignore cleanup errors
            }
          }
        },
      });
    });

    archive.on('error', (err: Error) => {
      reject(err);
    });

    archive.pipe(output);
    archive.glob('**/*', {
      cwd: projectRoot,
      ignore: ignorePatterns,
      dot: true,
    });
    archive.finalize().catch(reject);
  });
}
