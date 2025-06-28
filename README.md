# Neox Minecraft Downloader - Versión Mejorada

Un módulo TypeScript optimizado para descargar versiones de Minecraft de manera eficiente y rápida.

## 🚀 Características Principales

### Mejoras de Rendimiento
- **Descargas Concurrentes**: Hasta 15 archivos simultáneos (configurable)
- **Verificación de Archivos**: Evita re-descargas innecesarias verificando hashes SHA1
- **Caché de Manifiestos**: Cachea la lista de versiones por 5 minutos
- **Reintentos Automáticos**: 3 intentos con backoff exponencial
- **Streaming Optimizado**: Mejor manejo de memoria para archivos grandes

### Funcionalidades
- ✅ Descarga de client JAR
- ✅ Descarga de librerías Java
- ✅ Descarga de assets del juego
- ✅ Descarga de librerías nativas
- ✅ Verificación de integridad con SHA1
- ✅ Progreso detallado en tiempo real
- ✅ Manejo robusto de errores

## 📦 Instalación

```bash
npm install
```

## 🎯 Uso Básico

```typescript
import { MinecraftDownloader } from '@cubiclauncher/neox-core';

const downloader = new MinecraftDownloader('./minecraft');

// Configurar listeners de eventos
downloader.on('progress', (progress) => {
  console.log(`${progress.type}: ${progress.percent}%`);
});

downloader.on('status', (message) => {
  console.log(message);
});

downloader.on('complete', (version) => {
  console.log(`¡Descarga completada para ${version}!`);
});

// Descargar una versión
await downloader.download('1.20.1');
```

## ⚡ Configuración Avanzada

### Ajustar Concurrencia
```typescript
// Aumentar el número de descargas simultáneas (1-50)
downloader.setMaxConcurrentDownloads(20);
```

### Limpiar Caché
```typescript
// Forzar re-descarga del manifiesto de versiones
downloader.clearCache();
```

## 📊 Eventos Disponibles

### `progress`
Información detallada del progreso de descarga:
```typescript
{
  version: string;
  percent: number;
  type: 'client' | 'library' | 'asset' | 'native';
  currentFile?: string;
  totalFiles?: number;
  downloadedFiles?: number;
  totalSize?: number;
  downloadedSize?: number;
}
```

### `status`
Mensajes de estado del proceso:
```typescript
(message: string) => void
```

### `file-complete`
Notificación cuando un archivo se completa:
```typescript
(filename: string, type: string) => void
```

### `error`
Errores durante la descarga:
```typescript
(error: Error) => void
```

### `complete`
Descarga finalizada:
```typescript
(version: string) => void
```

## 🧪 Ejemplo Completo

Ejecuta el ejemplo mejorado:

```bash
npx ts-node src/test/improved-download.ts
```

Este ejemplo demuestra:
- Configuración de concurrencia
- Eventos detallados con emojis
- Medición de tiempo de descarga
- Manejo de errores

## 📈 Mejoras de Rendimiento

### Antes vs Después

| Característica | Versión Anterior | Versión Mejorada |
|----------------|------------------|------------------|
| Descargas | Secuenciales | Concurrentes (15 simultáneas) |
| Verificación | Sin verificación | SHA1 automático |
| Caché | Sin caché | 5 minutos |
| Reintentos | Sin reintentos | 3 intentos automáticos |
| Progreso | Básico | Detallado con bytes |
| Memoria | Alta | Optimizada |

### Beneficios Esperados
- **3-5x más rápido** en conexiones rápidas
- **Menos uso de ancho de banda** (evita re-descargas)
- **Mayor confiabilidad** (reintentos automáticos)
- **Mejor experiencia de usuario** (progreso detallado)

## 🔧 Configuración de Red

El módulo incluye configuraciones optimizadas:
- Timeout de 30 segundos por archivo
- Chunks de 1MB para streaming
- Backoff exponencial en reintentos
- Control de concurrencia para evitar sobrecarga

## 📁 Estructura de Archivos

```
minecraft/
├── versions/
│   └── 1.20.1/
│       ├── 1.20.1.json
│       └── 1.20.1.jar
├── libraries/
│   └── [librerías Java]
├── assets/
│   ├── indexes/
│   └── objects/
└── natives/
    └── [librerías nativas]
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📄 Licencia

MIT License - ver [LICENSE](LICENSE) para detalles.
