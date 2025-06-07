# Neox Minecraft Downloader

descargador de versiones de Minecraft construido con TypeScript y Bun.

## Características

- Descarga de cualquier versión de Minecraft
- Gestión automática de librerías
- Descarga de recursos del juego
- Gestión de dependencias nativas
- Seguimiento de progreso y eventos
- Construido pensando en el rendimiento

## Instalación

```bash
# Clonar el repositorio
git clone https://github.com/CubicLauncher/neox.git
cd neox

# Instalar dependencias
bun install
```

## Uso

```typescript
import { MinecraftDownloader } from 'neox-core';

const downloader = new MinecraftDownloader('./minecraft');

// Agregar listeners para seguimiento del progreso
downloader.on('progress', (progress) => {
  console.log(`Descargando ${progress.type}: ${progress.percent}%`);
});

downloader.on('status', (message) => {
  console.log(message);
});

// Descargar una versión específica
await downloader.download('1.19.2');
```

## Referencia de la API

### `MinecraftDownloader`

#### Constructor
```typescript
new MinecraftDownloader(baseDir: string)
```

#### Métodos

- `download(version: string): Promise<void>` - Descarga una versión específica de Minecraft
- `getAvailableVersions(): Promise<string[]>` - Obtiene todas las versiones disponibles
- `getLatestRelease(): Promise<string>` - Obtiene la última versión estable
- `getLatestSnapshot(): Promise<string>` - Obtiene la última versión snapshot

#### Eventos

- `progress` - Emitido durante el progreso de descarga
- `status` - Emitido para actualizaciones de estado
- `error` - Emitido cuando ocurre un error
- `complete` - Emitido cuando se completa la descarga

## Desarrollo

### Compilación

```bash

# Compilación básica
bun run build

# Compilación completa (código + tipos)
bun run build:all

# Compilación minificada para producción
bun run build:minify

```

## Contribuir

1. Haz un fork del repositorio
2. Crea tu rama de características (`git checkout -b feature/caracteristica-increible`)
3. Haz commit de tus cambios (`git commit -m 'Agregar alguna característica increíble'`)
4. Haz push a la rama (`git push origin feature/caracteristica-increible`)
5. Abre un Pull Request

## Licencia

Este proyecto está licenciado bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.