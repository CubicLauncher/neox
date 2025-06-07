import { MinecraftDownloader } from '../components/main/Downloader';

async function main() {
  const downloader = new MinecraftDownloader('./minecraft');

  // Escuchar eventos de progreso
  downloader.on('progress', (progress) => {
    console.log(`Descargando ${progress.currentFile} (${progress.type}): ${progress.percent}%`);
  });

  // Escuchar mensajes de estado
  downloader.on('status', (message) => {
    console.log(message);
  });

  // Manejar errores
  downloader.on('error', (error) => {
    console.error('Error:', error.message);
  });

  // Cuando se complete la descarga
  downloader.on('complete', (version) => {
    console.log(`¡Minecraft ${version} descargado completamente!`);
  });

  try {
    // Obtener la última versión y descargarla
    await downloader.download('1.8');
  } catch (error) {
    console.error('\n❌ Error durante download:', error instanceof Error ? error.message : error);
  }
}

// Run the test
console.log('🎮 Minecraft Downloader Test');
console.log('==========================\n');
main(); 