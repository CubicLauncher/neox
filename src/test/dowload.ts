import { MinecraftDownloader } from '../components/main/Downloader';

async function main() {
  const downloader = new MinecraftDownloader('./minecraft');

  // Configurar concurrencia para mejor rendimiento
  downloader.setMaxConcurrentDownloads(10);

  // Escuchar eventos de progreso mejorados
  downloader.on('progress', (progress) => {
    if (progress.currentFile) {
      console.log(`📥 ${progress.type}: ${progress.currentFile} - ${progress.percent}%`);
    } else if (progress.downloadedFiles && progress.totalFiles) {
      console.log(`📊 Progreso general: ${progress.downloadedFiles}/${progress.totalFiles} archivos (${progress.percent}%)`);
    }
  });

  // Escuchar mensajes de estado
  downloader.on('status', (message) => {
    console.log(`📋 ${message}`);
  });

  // Escuchar archivos completados
  downloader.on('file-complete', (filename, type) => {
    console.log(`✅ Completado: ${filename} (${type})`);
  });

  // Manejar errores
  downloader.on('error', (error) => {
    console.error('❌ Error:', error.message);
  });

  // Cuando se complete la descarga
  downloader.on('complete', (version) => {
    console.log(`🎉 ¡Minecraft ${version} descargado completamente!`);
  });

  try {
    console.log('🚀 Iniciando descarga con módulo mejorado...');
    console.log('⚡ Características activadas:');
    console.log('   • Descargas concurrentes (10 simultáneas)');
    console.log('   • Verificación de archivos existentes');
    console.log('   • Caché de manifiestos');
    console.log('   • Reintentos automáticos');
    console.log('   • Verificación SHA1\n');

    const startTime = Date.now();
    
    // Obtener la última versión y descargarla
    await downloader.download('1.8');
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    console.log(`\n⏱️  Tiempo total: ${duration.toFixed(2)} segundos`);
    
  } catch (error) {
    console.error('\n❌ Error durante download:', error instanceof Error ? error.message : error);
  }
}

// Run the test
console.log('🎮 Minecraft Downloader Test - Versión Mejorada');
console.log('==============================================\n');
main(); 