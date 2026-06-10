import { Injectable, Logger } from '@nestjs/common';
import * as Docker from 'dockerode';
import * as fs from 'fs/promises';
import * as os from 'os';
import { Readable } from 'stream';

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const DEFAULT_AGENT_IMAGE = 'agent-sandbox:latest';
const DEFAULT_MEMORY_LIMIT = 512 * 1024 * 1024; // 512 MB
const DEFAULT_TOOL_TIMEOUT_MS = 30_000; // 30s per tool call

@Injectable()
export class DockerService {
  private readonly docker: Docker;
  private available = false;

  constructor() {
    try {
      const socketPath = process.platform === 'win32'
        ? '//./pipe/docker_engine'
        : '/var/run/docker.sock';
      this.docker = new Docker({ socketPath });
      this.available = true;
      Logger.log(`DockerService initialized (${process.platform}, socket: ${socketPath})`);
    } catch (err) {
      Logger.warn('DockerService unavailable — Docker is not running on this host');
      this.docker = undefined!;
      this.available = false;
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  /**
   * Create a sandbox container.
   * Returns the container ID.
   */
  async createContainer(
    image: string,
    workspaceDir: string,
    timeoutSec: number,
  ): Promise<string> {
    if (!this.available) throw new Error('Docker is not available on this host');

    const img = image || DEFAULT_AGENT_IMAGE;

    // Ensure workspace directory exists on host
    await fs.mkdir(workspaceDir, { recursive: true });

    Logger.debug(`Docker: creating container image=${img} workspace=${workspaceDir} timeout=${timeoutSec}s`);

    const container = await this.docker.createContainer({
      Image: img,
      Cmd: ['sleep', String(timeoutSec)],
      StopTimeout: 5,
      HostConfig: {
        AutoRemove: false,
        Memory: DEFAULT_MEMORY_LIMIT,
        MemorySwap: DEFAULT_MEMORY_LIMIT * 2,
        CpuShares: 512,
        NetworkMode: 'bridge',
        Binds: [`${workspaceDir}:/workspace`],
        ReadonlyRootfs: false,
        SecurityOpt: ['no-new-privileges:true'],
      },
    });

    await container.start();
    Logger.debug(`Docker: container ${container.id.slice(0, 12)} started`);

    return container.id;
  }

  /**
   * Execute a command inside a running container.
   * Runs via bash -c with a timeout.
   */
  async execInContainer(
    containerId: string,
    cmd: string,
    workingDir: string,
    timeoutMs: number = DEFAULT_TOOL_TIMEOUT_MS,
  ): Promise<ExecResult> {
    if (!this.available) throw new Error('Docker is not available on this host');

    const container = this.docker.getContainer(containerId);

    Logger.debug(`Docker: exec in ${containerId.slice(0, 12)}: ${cmd.slice(0, 200)}`);

    const exec = await container.exec({
      Cmd: ['bash', '-c', cmd],
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: workingDir || '/workspace',
    });

    const stream = await exec.start({ Detach: false, Tty: false });

    // Collect output with timeout
    const result = await this.collectStream(stream, timeoutMs);

    Logger.debug(`Docker: exec result exit=${result.exitCode} stdout=${result.stdout.slice(0, 100)}`);
    return result;
  }

  /**
   * Destroy (stop + remove) a container.
   */
  async destroyContainer(containerId: string): Promise<void> {
    if (!this.available) return;
    try {
      const container = this.docker.getContainer(containerId);
      await container.stop({ t: 5 }).catch(() => {});
      await container.remove({ force: true }).catch(() => {});
      Logger.debug(`Docker: container ${containerId.slice(0, 12)} destroyed`);
    } catch (err) {
      Logger.warn(`Docker: failed to destroy container ${containerId.slice(0, 12)}:`, err);
    }
  }

  private collectStream(
    stream: Readable,
    timeoutMs: number,
  ): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      const exitCode = -1;
      let done = false;

      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          try { stream.destroy(); } catch {}
          resolve({ exitCode, stdout, stderr: stderr + '\n[TIMEOUT]' });
        }
      }, timeoutMs);

      stream.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      stream.on('end', () => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve({ exitCode, stdout, stderr });
        }
      });

      stream.on('error', (err) => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          reject(err);
        }
      });
    });
  }
}
