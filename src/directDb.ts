import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

type DirectReadOptions = {
  forceSnapshot?: boolean;
};

export async function extractRawDumpFromDataDirDirect(
  dataDir: string,
  options: DirectReadOptions = {}
): Promise<Record<string, unknown>> {
  const manifestPath = getExporterManifestPath();
  const lockCheck = await detectActiveDbLock(dataDir);
  let readDir = dataDir;

  if (lockCheck.locked && !options.forceSnapshot) {
    throw new Error(
      `Direct DB read skipped because data directory is currently in use by process ${lockCheck.processName ?? "unknown"} ` +
        `(pid=${lockCheck.pid ?? "?"}). Retry with --force-snapshot to read from a temporary copy.`
    );
  }

  if (options.forceSnapshot) {
    readDir = await createSnapshotCopy(dataDir);
  }

  const cargoInvocation = await resolveCargoInvocation();
  let output: string;
  try {
    output = await runCommand(cargoInvocation.command, [
      ...cargoInvocation.prefixArgs,
      "run",
      "--quiet",
      "--manifest-path",
      manifestPath,
      "--",
      readDir,
    ]);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("already locked")) {
      throw new Error(
        `Direct DB read failed because the data directory is currently locked by another process. ` +
          `Stop the running memory-mcp process that uses this --data-dir and retry.`
      );
    }
    if (msg.includes("unexpected end of file") || msg.includes("failed to fill whole buffer")) {
      throw new Error(
        `Direct DB read failed due to WAL corruption/incomplete state in this data directory. ` +
          `Please gracefully stop memory-mcp first, then retry. If it still fails, repair/restore the DB before visualization.`
      );
    }
    throw error;
  } finally {
    if (readDir !== dataDir) {
      await fs.rm(readDir, { recursive: true, force: true });
    }
  }

  const parsed = JSON.parse(output) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Direct DB export returned invalid payload");
  }
  return parsed as Record<string, unknown>;
}

export async function hasDirectDbLayout(dataDir: string): Promise<boolean> {
  const candidates = [
    path.resolve(dataDir, "db", "wal"),
    path.resolve(dataDir, "db", "manifest"),
  ];
  const fs = await import("node:fs/promises");
  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (!stat.isDirectory()) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

function getExporterManifestPath(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  return path.resolve(currentDir, "..", "tools", "mmgraph-surreal-export", "Cargo.toml");
}

async function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      reject(new Error(`Failed to run ${command}: ${error.message}`));
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`${command} failed with code ${code ?? -1}: ${stderr.trim()}`));
      }
    });
  });
}

async function resolveCargoInvocation(): Promise<{ command: string; prefixArgs: string[] }> {
  if (await commandSucceeds("rustup", ["run", "stable", "cargo", "--version"])) {
    return { command: "rustup", prefixArgs: ["run", "stable", "cargo"] };
  }
  if (await commandSucceeds("cargo", ["--version"])) {
    return { command: "cargo", prefixArgs: [] };
  }
  throw new Error("Rust toolchain is required for direct DB extraction (cargo/rustup not found)");
}

async function commandSucceeds(command: string, args: string[]): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "ignore", "ignore"],
      env: process.env,
    });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}

async function detectActiveDbLock(
  dataDir: string
): Promise<{ locked: boolean; pid?: string; processName?: string }> {
  const lockFile = path.resolve(dataDir, "db", "LOCK");
  if (!(await fileExists(lockFile))) {
    return { locked: false };
  }

  const lsofOutput = await runCommandAllowFailure("lsof", [lockFile]);
  if (!lsofOutput.ok || !lsofOutput.stdout.trim()) {
    return { locked: false };
  }

  const lines = lsofOutput.stdout.trim().split("\n");
  if (lines.length <= 1) {
    return { locked: false };
  }

  const fields = lines[1].trim().split(/\s+/);
  return {
    locked: true,
    processName: fields[0],
    pid: fields[1],
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function runCommandAllowFailure(
  command: string,
  args: string[]
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", () => {
      resolve({ ok: false, stdout: "", stderr: "" });
    });
    child.on("exit", (code) => {
      resolve({ ok: code === 0, stdout, stderr });
    });
  });
}

async function createSnapshotCopy(sourceDir: string): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mmgraph-db-snapshot-"));
  await fs.cp(sourceDir, tempDir, { recursive: true, force: true });
  await fs.rm(path.resolve(tempDir, "db", "LOCK"), { force: true });
  return tempDir;
}
