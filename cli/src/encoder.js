import { spawn } from 'child_process';

export function createEncoder(options) {
  const { output, fps, codec, quality, audioPath } = options;

  const args = [
    '-y',
    '-f', 'image2pipe',
    '-framerate', String(fps),
    '-i', 'pipe:0',
  ];

  if (audioPath) {
    args.push('-i', audioPath);
  }

  args.push(
    '-c:v', codec,
    '-pix_fmt', 'yuv420p',
    '-preset', quality,
    '-crf', '18',
    '-movflags', '+faststart',
  );

  if (audioPath) {
    args.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
  }

  args.push(output);

  const proc = spawn('ffmpeg', args, {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let stderr = '';
  proc.stderr.on('data', (d) => {
    stderr += d.toString();
    if (stderr.length > 2000) stderr = stderr.slice(-2000);
  });

  let spawnError = null;
  proc.on('error', (err) => { spawnError = err; });

  return {
    write(pngBuf) {
      return new Promise((resolve, reject) => {
        proc.stdin.once('error', reject);
        const ok = proc.stdin.write(pngBuf);
        if (ok) resolve();
        else proc.stdin.once('drain', resolve);
      });
    },
    async finish() {
      if (spawnError) return Promise.reject(spawnError);
      return new Promise((resolve, reject) => {
        if (proc.exitCode !== null) {
          if (proc.exitCode === 0) return resolve();
          return reject(new Error(`FFmpeg exited with code ${proc.exitCode}:\n${stderr.slice(-500)}`));
        }
        proc.stdin.end();
        proc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`FFmpeg exited with code ${code}:\n${stderr.slice(-500)}`));
        });
        proc.on('error', reject);
      });
    },
    stderr() { return stderr; }
  };
}
