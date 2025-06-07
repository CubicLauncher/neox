import axios, { AxiosProgressEvent } from 'axios';
import * as fs from 'fs-extra';
import * as path from 'path';
import { EventEmitter } from 'events';
import { DownloadOptions, MinecraftVersion, VersionManifest, MinecraftLibrary } from '../others/types';

interface DownloadProgress {
  version: string;
  percent: number;
  type: 'client' | 'library' | 'asset' | 'native';
  currentFile?: string;
  totalFiles?: number;
}

type DownloadEvents = {
  'progress': (progress: DownloadProgress) => void;
  'status': (message: string) => void;
  'error': (error: Error) => void;
  'complete': (version: string) => void;
}

/**
 * MinecraftDownloader class handles downloading Minecraft game files including the client,
 * libraries, assets and native dependencies.
 * 
 * @example
 * ```typescript
 * const downloader = new MinecraftDownloader('./minecraft');
 * 
 * // Add event listeners
 * downloader.on('progress', (progress) => {
 *   console.log(`Downloading ${progress.type}: ${progress.percent}%`);
 * });
 * 
 * downloader.on('status', (message) => {
 *   console.log(message);
 * });
 * 
 * // Download a specific version
 * await downloader.download('1.19.2');
 * ```
 */
export class MinecraftDownloader extends EventEmitter {
  private readonly MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';
  private readonly RESOURCES_URL = 'https://resources.download.minecraft.net';

  constructor(private baseDir: string) {
    super();
    fs.ensureDirSync(baseDir);
  }

  /**
   * Downloads a file from a URL to a destination path with progress tracking
   */
  private async downloadFile(url: string, destination: string, version: string, fileType: DownloadProgress['type']): Promise<void> {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      onDownloadProgress: (progressEvent: AxiosProgressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          this.emit('progress', { 
            version, 
            percent,
            type: fileType,
            currentFile: path.basename(destination)
          });
        }
      }
    });

    const writer = fs.createWriteStream(destination);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  /**
   * Gets the version manifest containing all available Minecraft versions
   * @returns Promise<VersionManifest>
   */
  public async getVersionManifest(): Promise<VersionManifest> {
    const response = await axios.get<VersionManifest>(this.MANIFEST_URL);
    return response.data;
  }

  /**
   * Gets detailed information about a specific Minecraft version
   * @param version - The Minecraft version to get info for (e.g. '1.19.2')
   */
  private async getVersionInfo(version: string): Promise<MinecraftVersion> {
    const manifest = await this.getVersionManifest();
    const versionData = manifest.versions.find(v => v.id === version);
    
    if (!versionData) {
      throw new Error(`Version ${version} not found`);
    }

    const versionInfo = await axios.get<MinecraftVersion>(versionData.url);
    return versionInfo.data;
  }

  /**
   * Gets a list of all available Minecraft versions
   * @returns Promise<string[]> Array of version strings
   */
  public async getAvailableVersions(): Promise<string[]> {
    const manifest = await this.getVersionManifest();
    return manifest.versions.map(v => v.id);
  }

  /**
   * Gets the latest release version of Minecraft
   * @returns Promise<string> Latest release version
   */
  public async getLatestRelease(): Promise<string> {
    const manifest = await this.getVersionManifest();
    return manifest.latest.release;
  }

  /**
   * Gets the latest snapshot version of Minecraft
   * @returns Promise<string> Latest snapshot version
   */
  public async getLatestSnapshot(): Promise<string> {
    const manifest = await this.getVersionManifest();
    return manifest.latest.snapshot;
  }

  /**
   * Downloads a specific version of Minecraft with all its dependencies
   * @param version - The Minecraft version to download (e.g. '1.19.2')
   */
  public async download(version: string): Promise<void> {
    try {
      this.emit('status', `Starting download of Minecraft ${version}`);
      
      const versionInfo = await this.getVersionInfo(version);
      const versionDir = path.join(this.baseDir, 'versions', version);
      fs.ensureDirSync(versionDir);

      // Save version JSON
      this.emit('status', 'Downloading version manifest');
      await fs.writeJson(path.join(versionDir, `${version}.json`), versionInfo, { spaces: 2 });

      // Download client jar
      this.emit('status', 'Downloading client JAR');
      await this.downloadFile(
        versionInfo.downloads.client.url,
        path.join(versionDir, `${version}.jar`),
        version,
        'client'
      );

      // Download libraries
      this.emit('status', 'Downloading libraries');
      await this.downloadLibraries(versionInfo.libraries, version);

      // Download assets
      if (versionInfo.assetIndex) {
        this.emit('status', 'Downloading game assets');
        await this.downloadAssets(versionInfo.assetIndex, version);
      }

      this.emit('status', 'Download completed');
      this.emit('complete', version);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', new Error(`Download failed: ${errorMessage}`));
      throw error;
    }
  }

  private async downloadLibraries(libraries: any[], version: string): Promise<void> {
    const librariesDir = path.join(this.baseDir, 'libraries');
    fs.ensureDirSync(librariesDir);

    for (const library of libraries) {
      if (library.downloads.artifact) {
        const artifactPath = path.join(librariesDir, library.downloads.artifact.path);
        fs.ensureDirSync(path.dirname(artifactPath));
        
        this.emit('status', `Downloading library: ${library.name}`);
        await this.downloadFile(
          library.downloads.artifact.url,
          artifactPath,
          version,
          'library'
        );
      }

      if (library.downloads.classifiers) {
        const nativesDir = path.join(this.baseDir, 'natives');
        fs.ensureDirSync(nativesDir);
        
        for (const [classifier, native] of Object.entries(library.downloads.classifiers)) {
          if (classifier.includes('natives')) {
            const nativePath = path.join(nativesDir, path.basename((native as any).path));
            this.emit('status', `Downloading native: ${library.name} (${classifier})`);
            await this.downloadFile(
              (native as any).url,
              nativePath,
              version,
              'native'
            );
          }
        }
      }
    }
  }

  private async downloadAssets(assetIndex: any, version: string): Promise<void> {
    const assetsDir = path.join(this.baseDir, 'assets');
    const indexesDir = path.join(assetsDir, 'indexes');
    const objectsDir = path.join(assetsDir, 'objects');

    fs.ensureDirSync(indexesDir);
    fs.ensureDirSync(objectsDir);

    // Download asset index
    this.emit('status', `Downloading asset index: ${assetIndex.id}`);
    const indexResponse = await axios.get(assetIndex.url);
    await fs.writeJson(
      path.join(indexesDir, `${assetIndex.id}.json`),
      indexResponse.data,
      { spaces: 2 }
    );

    // Download assets
    const assets = indexResponse.data.objects;
    let downloadedAssets = 0;
    const totalAssets = Object.keys(assets).length;

    for (const [assetName, asset] of Object.entries(assets)) {
      const hash = (asset as any).hash;
      const prefix = hash.substring(0, 2);
      const assetPath = path.join(objectsDir, prefix, hash);

      if (!fs.existsSync(assetPath)) {
        fs.ensureDirSync(path.dirname(assetPath));
        this.emit('status', `Downloading asset: ${assetName}`);
        await this.downloadFile(
          `${this.RESOURCES_URL}/${prefix}/${hash}`,
          assetPath,
          version,
          'asset'
        );
      }

      downloadedAssets++;
      const percent = Math.round((downloadedAssets / totalAssets) * 100);
      this.emit('progress', { 
        version, 
        percent,
        type: 'asset',
        currentFile: assetName,
        totalFiles: totalAssets
      });
    }
  }
} 