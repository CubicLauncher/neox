import { MinecraftDownloader } from '../components/main/Downloader';
import * as path from 'path';

async function demonstrateImprovedDownloader() {
  console.log('🚀 Iniciando demostración del Minecraft Downloader mejorado...\n');

  // Crear instancia del downloader
  const downloadDir = path.join(__dirname, '../../minecraft');
  const downloader = new MinecraftDownloader(downloadDir);

  // Configurar el número máximo de descargas concurrentes (opcional)
  downloader.setMaxConcurrentDownloads(15);

  // Configurar event listeners para mejor seguimiento
  downloader.on('status', (message) => {
    console.log(`📋 ${message}`);
  });

  downloader.on('progress', (progress) => {
    const typeEmoji: Record<string, string> = {
      'client': '📦',
      'library': '📚',
      'asset': '🎨',
      'native': '🔧'
    };
    
    const emoji = typeEmoji[progress.type] || '📄';
    
    if (progress.currentFile) {
      console.log(`${emoji} ${progress.type}: ${progress.currentFile} - ${progress.percent}%`);
    } else if (progress.downloadedFiles && progress.totalFiles) {
      console.log(`📊 Progreso general: ${progress.downloadedFiles}/${progress.totalFiles} archivos (${progress.percent}%)`);
    }
  });

  downloader.on('file-complete', (filename, type) => {
    const typeEmoji: Record<string, string> = {
      'client': '✅',
      'library': '📚',
      'asset': '🎨',
      'native': '🔧'
    };
    console.log(`${typeEmoji[type] || '✅'} Completado: ${filename}`);
  });

  downloader.on('error', (error) => {
    console.error(`❌ Error: ${error.message}`);
  });

  downloader.on('complete', (version) => {
    console.log(`\n🎉 ¡Descarga completada exitosamente para Minecraft ${version}!`);
    console.log(`📁 Archivos guardados en: ${downloadDir}`);
  });

  try {
    // Obtener información de versiones disponibles
    console.log('📋 Obteniendo lista de versiones disponibles...');
    const versions = await downloader.getAvailableVersions();
    console.log(`📋 Se encontraron ${versions.length} versiones disponibles`);

    // Obtener la última versión release
    const latestRelease = await downloader.getLatestRelease();
    console.log(`📋 Última versión release: ${latestRelease}`);

    // Descargar una versión específica (usando una versión más reciente para demostración)
    const targetVersion = '1.20.1'; // Puedes cambiar esto a la versión que desees
    
    console.log(`\n🚀 Iniciando descarga de Minecraft ${targetVersion}...`);
    console.log('⏱️  Esta descarga será mucho más rápida gracias a las mejoras:');
    console.log('   • Descargas concurrentes (hasta 15 archivos simultáneos)');
    console.log('   • Verificación de archivos existentes (evita re-descargas)');
    console.log('   • Caché de manifiestos (5 minutos)');
    console.log('   • Reintentos automáticos en caso de error');
    console.log('   • Verificación de integridad con SHA1\n');

    const startTime = Date.now();
    await downloader.download(targetVersion);
    const endTime = Date.now();
    
    const duration = (endTime - startTime) / 1000;
    console.log(`\n⏱️  Tiempo total de descarga: ${duration.toFixed(2)} segundos`);

  } catch (error) {
    console.error('❌ Error durante la descarga:', error);
  }
}

// Función para limpiar caché (útil para forzar re-descarga de manifiestos)
async function clearCache() {
  const downloader = new MinecraftDownloader('./minecraft');
  downloader.clearCache();
  console.log('🗑️  Caché limpiado');
}

// Ejecutar la demostración
if (require.main === module) {
  demonstrateImprovedDownloader().catch(console.error);
}

export { demonstrateImprovedDownloader, clearCache }; 