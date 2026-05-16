// afterPack hook — ensure ffmpeg-static binary exec bit on mac/linux
//
// บน mac/linux ffmpeg-static binary บางครั้งโดน strip exec bit ตอน asar unpack
// → spawn ไม่ได้ → render คลิปไม่ทำงาน
// fix: chmod 0o755 ให้แน่ใจ

const fs = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName === 'win32') return;

  const appOutDir = context.appOutDir;
  const platform = context.electronPlatformName;

  const macPath = path.join(
    appOutDir,
    `${context.packager.appInfo.productName}.app`,
    'Contents',
    'Resources',
    'app.asar.unpacked',
    'node_modules',
    'ffmpeg-static',
    'ffmpeg'
  );
  const linuxPath = path.join(
    appOutDir,
    'resources',
    'app.asar.unpacked',
    'node_modules',
    'ffmpeg-static',
    'ffmpeg'
  );
  const candidates = platform === 'darwin' ? [macPath] : [linuxPath];

  for (const ffmpegPath of candidates) {
    if (!fs.existsSync(ffmpegPath)) {
      console.warn(`[afterPack] ffmpeg not found at ${ffmpegPath} — skip chmod`);
      continue;
    }
    try {
      fs.chmodSync(ffmpegPath, 0o755);
      console.log(`[afterPack] chmod +x ${ffmpegPath}`);
    } catch (err) {
      console.error(`[afterPack] chmod failed for ${ffmpegPath}:`, err.message);
    }
  }
};
