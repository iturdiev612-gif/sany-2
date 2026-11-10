/* Convert studio PNG originals to web-ready WebP; preserve originals separately. */
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');

async function loadSharp() {
  const choices = [process.env.SHARP_PATH, 'sharp',
    'C:/Users/Windows.KG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'];
  for (const candidate of choices.filter(Boolean)) {
    try { return require(candidate); } catch (error) {
      if (candidate === process.env.SHARP_PATH) throw error;
    }
  }
  throw new Error('Install sharp, or set SHARP_PATH to its absolute package directory.');
}

function ensureChild(parent, child) {
  const relative = path.relative(parent, child);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Unsafe asset target: ${child}`);
  }
}

async function main() {
  const sharp = await loadSharp();
  const project = path.resolve(__dirname, '..');
  const outputs = path.resolve(project, '..');
  const assets = path.join(project, 'public', 'assets');
  const originals = path.join(outputs, 'sany-photo-originals');
  ensureChild(project, assets);
  ensureChild(outputs, originals);
  await fs.mkdir(originals, { recursive: true });
  const inputs = (await fs.readdir(assets)).filter(name => /^truck-(?:0[1-9]|1[0-5])\.png$/.test(name)).sort();
  for (const name of inputs) {
    const input = path.join(assets, name);
    const output = path.join(assets, name.replace(/\.png$/, '.webp'));
    const archived = path.join(originals, name);
    ensureChild(assets, input);
    ensureChild(assets, output);
    ensureChild(originals, archived);
    await sharp(input).resize({ width: 1536, withoutEnlargement: true })
      .webp({ quality: 82, effort: 6 }).toFile(output);
    const meta = await sharp(output).metadata();
    if (meta.format !== 'webp' || meta.width > 1536 || !meta.height) {
      throw new Error(`Verification failed: ${output}`);
    }
    try {
      await fs.access(archived);
      const digest = data => createHash('sha256').update(data).digest('hex');
      if (digest(await fs.readFile(input)) !== digest(await fs.readFile(archived))) {
        throw new Error(`Original already exists with different content: ${archived}`);
      }
      // Preserve both copies rather than removing anything on a repeat run.
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await fs.rename(input, archived);
    }
    console.log(`${name} -> ${path.basename(output)} (${(await fs.stat(output)).size} bytes)`);
  }
  const webps = (await fs.readdir(assets)).filter(name => /^truck-(?:0[1-9]|1[0-5])\.webp$/.test(name)).sort();
  const total = (await Promise.all(webps.map(name => fs.stat(path.join(assets, name)))))
    .reduce((sum, stat) => sum + stat.size, 0);
  console.log(JSON.stringify({ count: webps.length, totalBytes: total, assets, originals }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
