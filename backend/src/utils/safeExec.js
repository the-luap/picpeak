const { spawn } = require('child_process');

/**
 * Safe command execution utilities using spawn (shell: false).
 * These prevent command injection by never invoking a shell interpreter.
 */

/**
 * Run a command with arguments, returning { stdout, stderr }.
 * Equivalent to execAsync(cmd) but safe from injection.
 */
function spawnAsync(cmd, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      shell: false,
      ...options,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const stdoutChunks = [];
    const stderrChunks = [];

    child.stdout.on('data', chunk => stdoutChunks.push(chunk));
    child.stderr.on('data', chunk => stderrChunks.push(chunk));

    child.on('error', reject);
    child.on('close', (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString();
      const stderr = Buffer.concat(stderrChunks).toString();
      if (code !== 0) {
        const err = new Error(`${cmd} exited with code ${code}: ${stderr}`);
        err.code = code;
        err.stdout = stdout;
        err.stderr = stderr;
        return reject(err);
      }
      resolve({ stdout, stderr });
    });
  });
}

/**
 * Run a command and redirect stdout to a file (replaces shell `> file`).
 */
function spawnToFile(cmd, args, outputPath, options = {}) {
  const fs = require('fs');
  return new Promise((resolve, reject) => {
    const outStream = fs.createWriteStream(outputPath);
    const child = spawn(cmd, args, {
      shell: false,
      ...options,
      stdio: ['ignore', outStream, 'pipe']
    });

    const stderrChunks = [];
    child.stderr.on('data', chunk => stderrChunks.push(chunk));

    child.on('error', (err) => {
      outStream.destroy();
      reject(err);
    });
    child.on('close', (code) => {
      outStream.end();
      const stderr = Buffer.concat(stderrChunks).toString();
      if (code !== 0) {
        const err = new Error(`${cmd} exited with code ${code}: ${stderr}`);
        err.code = code;
        err.stderr = stderr;
        return reject(err);
      }
      resolve({ stderr });
    });
  });
}

/**
 * Run a command and pipe a file into stdin (replaces shell `< file`).
 */
function spawnFromFile(cmd, args, inputPath, options = {}) {
  const fs = require('fs');
  return new Promise((resolve, reject) => {
    const inStream = fs.createReadStream(inputPath);
    const child = spawn(cmd, args, {
      shell: false,
      ...options,
      stdio: [inStream, 'pipe', 'pipe']
    });

    const stdoutChunks = [];
    const stderrChunks = [];
    child.stdout.on('data', chunk => stdoutChunks.push(chunk));
    child.stderr.on('data', chunk => stderrChunks.push(chunk));

    child.on('error', (err) => {
      inStream.destroy();
      reject(err);
    });
    child.on('close', (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString();
      const stderr = Buffer.concat(stderrChunks).toString();
      if (code !== 0) {
        const err = new Error(`${cmd} exited with code ${code}: ${stderr}`);
        err.code = code;
        err.stdout = stdout;
        err.stderr = stderr;
        return reject(err);
      }
      resolve({ stdout, stderr });
    });
  });
}

module.exports = { spawnAsync, spawnToFile, spawnFromFile };
