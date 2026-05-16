// afterSign hook — deep ad-hoc sign บน mac เพื่อกัน "is damaged" บน Apple Silicon
// (รายละเอียดเหมือน INKCRAW/INKTTS — ดู Mac install section ใน README)

const { execSync } = require('node:child_process');

exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appPath = `${context.appOutDir}/${context.packager.appInfo.productName}.app`;

  console.log(`[afterSign] re-applying ad-hoc deep sign to ${appPath}`);
  try {
    execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
    execSync(`codesign --verify --deep --strict "${appPath}"`, { stdio: 'inherit' });
    console.log('[afterSign] deep sign + verify success');
  } catch (err) {
    console.error('[afterSign] codesign failed:', err.message);
  }
};
