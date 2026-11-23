const { execSync } = require('child_process');
const path = require('path');

console.log('[Zip Archiver] Packaging clean source code into healthcare-appointment-manager.zip...');

const zipFileName = 'healthcare-appointment-manager.zip';
const rootDir = __dirname || process.cwd();

try {
  // PowerShell command copying source directories & files without node_modules
  const psCommand = `powershell -Command "
    Remove-Item -Path '${rootDir}\\${zipFileName}' -ErrorAction SilentlyContinue;
    $files = @(
      'backend\\src',
      'backend\\prisma',
      'backend\\package.json',
      'backend\\.env.example',
      'frontend\\src',
      'frontend\\package.json',
      'frontend\\index.html',
      'frontend\\vite.config.js',
      'frontend\\tailwind.config.js',
      'frontend\\postcss.config.js',
      'README.md',
      'SYSTEM_DESIGN.md',
      '.env.example'
    );
    Compress-Archive -Path $files -DestinationPath '${rootDir}\\${zipFileName}' -Force
  "`;

  execSync(psCommand, { stdio: 'inherit' });
  console.log(`[Zip Archiver] Successfully generated deliverable archive: ${zipFileName}`);
} catch (err) {
  console.error('[Zip Archiver] Packaging failed:', err.message);
}
