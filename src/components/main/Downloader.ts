import axios, { AxiosProgressEvent, AxiosResponse } from 'axios';
import * as fs from 'fs-extra';
import * as path from 'path';
import { EventEmitter } from 'events';
import { DownloadOptions, MinecraftVersion, VersionManifest, MinecraftLibrary } from '../others/types';
import { createHash } from 'crypto';

interface DownloadProgress {
  version: string;
  percent: number;
  type: 'client' | 'library' | 'asset' | 'native';
  currentFile?: string;
  totalFiles?: number;
  downloadedFiles?: number;
  totalSize?: number;
  downloadedSize?: number;
}

type DownloadEvents = {
  'progress': (progress: DownloadProgress) => void;
  'status': (message: string) => void;
  'error': (error: Error) => void;
  'complete': (version: string) => void;
  'file-complete': (filename: string, type: string) => void;
}

interface DownloadTask {
  url: string;
  destination: string;
  type: DownloadProgress['type'];
  filename: string;
  expectedHash?: string;
  size?: number;
}

/**
 * MinecraftDownloader class handles downloading Minecraft game files including the client,
 * libraries, assets and native dependencies with optimized concurrent downloads.
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
  private MAX_CONCURRENT_DOWNLOADS = 10;
  private readonly CHUNK_SIZE = 1024 * 1024; // 1MB chunks
  private readonly RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  private manifestCache: VersionManifest | null = null;
  private manifestCacheTime = 0;
  private readonly MANIFEST_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor(private baseDir: string) {
    super();
    fs.ensureDirSync(baseDir);
  }

  /**
   * Calculates SHA1 hash of a file
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha1');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Checks if a file exists and has the correct hash
   */
  private async isFileValid(filePath: string, expectedHash?: string): Promise<boolean> {
    try {
      if (!fs.existsSync(filePath)) {
        return false;
      }

      if (expectedHash) {
        const actualHash = await this.calculateFileHash(filePath);
        return actualHash === expectedHash;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Downloads a file with retry logic and progress tracking
   */
  private async downloadFile(task: DownloadTask, version: string): Promise<void> {
    const { url, destination, type, filename, expectedHash, size } = task;

    // Check if file already exists and is valid
    if (await this.isFileValid(destination, expectedHash)) {
      this.emit('file-complete', filename, type);
      return;
    }

    // Ensure directory exists
    fs.ensureDirSync(path.dirname(destination));

    let lastAttempt = 0;
    while (lastAttempt < this.RETRY_ATTEMPTS) {
      try {
        const response = await axios({
          url,
          method: 'GET',
          responseType: 'stream',
          timeout: 30000, // 30 second timeout
          onDownloadProgress: (progressEvent: AxiosProgressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
              this.emit('progress', { 
                version, 
                percent,
                type,
                currentFile: filename,
                downloadedSize: progressEvent.loaded,
                totalSize: progressEvent.total
              });
            }
          }
        });

        const writer = fs.createWriteStream(destination);
        response.data.pipe(writer);

        await new Promise<void>((resolve, reject) => {
          writer.on('finish', () => resolve());
          writer.on('error', reject);
          response.data.on('error', reject);
        });

        // Verify hash if provided
        if (expectedHash) {
          const actualHash = await this.calculateFileHash(destination);
          if (actualHash !== expectedHash) {
            throw new Error(`Hash mismatch for ${filename}`);
          }
        }

        this.emit('file-complete', filename, type);
        return;
      } catch (error) {
        lastAttempt++;
        if (lastAttempt >= this.RETRY_ATTEMPTS) {
          throw new Error(`Failed to download ${filename} after ${this.RETRY_ATTEMPTS} attempts: ${error}`);
        }
        
        // Clean up partial download
        if (fs.existsSync(destination)) {
          fs.unlinkSync(destination);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * lastAttempt));
      }
    }
  }

  /**
   * Downloads multiple files concurrently with controlled concurrency
   */
  private async downloadFilesConcurrently(tasks: DownloadTask[], version: string): Promise<void> {
    const semaphore = new Array(this.MAX_CONCURRENT_DOWNLOADS).fill(null);
    let completedTasks = 0;
    const totalTasks = tasks.length;

    const downloadWithSemaphore = async (task: DownloadTask): Promise<void> => {
      const semaphoreIndex = semaphore.findIndex(s => s === null);
      semaphore[semaphoreIndex] = task;

      try {
        await this.downloadFile(task, version);
      } finally {
        semaphore[semaphoreIndex] = null;
        completedTasks++;
        
        // Emit overall progress
        const percent = Math.round((completedTasks / totalTasks) * 100);
        this.emit('progress', {
          version,
          percent,
          type: task.type,
          downloadedFiles: completedTasks,
          totalFiles: totalTasks
        });
      }
    };

    // Process tasks in batches
    const batches = [];
    for (let i = 0; i < tasks.length; i += this.MAX_CONCURRENT_DOWNLOADS) {
      batches.push(tasks.slice(i, i + this.MAX_CONCURRENT_DOWNLOADS));
    }

    for (const batch of batches) {
      await Promise.all(batch.map(downloadWithSemaphore));
    }
  }

  /**
   * Gets the version manifest with caching
   */
  public async getVersionManifest(): Promise<VersionManifest> {
    const now = Date.now();
    
    // Return cached manifest if still valid
    if (this.manifestCache && (now - this.manifestCacheTime) < this.MANIFEST_CACHE_DURATION) {
      return this.manifestCache;
    }

    const response = await axios.get<VersionManifest>(this.MANIFEST_URL);
    this.manifestCache = response.data;
    this.manifestCacheTime = now;
    return response.data;
  }

  /**
   * Gets detailed information about a specific Minecraft version
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
   */
  public async getAvailableVersions(): Promise<string[]> {
    const manifest = await this.getVersionManifest();
    return manifest.versions.map(v => v.id);
  }

  /**
   * Gets the latest release version of Minecraft
   */
  public async getLatestRelease(): Promise<string> {
    const manifest = await this.getVersionManifest();
    return manifest.latest.release;
  }

  /**
   * Gets the latest snapshot version of Minecraft
   */
  public async getLatestSnapshot(): Promise<string> {
    const manifest = await this.getVersionManifest();
    return manifest.latest.snapshot;
  }

  /**
   * Downloads a specific version of Minecraft with all its dependencies
   */
  public async download(version: string): Promise<void> {
    try {
      this.emit('status', `Starting download of Minecraft ${version}`);
      
      const versionInfo = await this.getVersionInfo(version);
      const versionDir = path.join(this.baseDir, 'versions', version);
      fs.ensureDirSync(versionDir);

      // Save version JSON
      this.emit('status', 'Saving version manifest');
      await fs.writeJson(path.join(versionDir, `${version}.json`), versionInfo, { spaces: 2 });

      // Prepare all download tasks
      const downloadTasks: DownloadTask[] = [];

      // Client JAR
      downloadTasks.push({
        url: versionInfo.downloads.client.url,
        destination: path.join(versionDir, `${version}.jar`),
        type: 'client',
        filename: `${version}.jar`,
        expectedHash: versionInfo.downloads.client.sha1,
        size: versionInfo.downloads.client.size
      });

      // Libraries
      this.emit('status', 'Preparing library downloads');
      const libraryTasks = this.prepareLibraryTasks(versionInfo.libraries, version);
      downloadTasks.push(...libraryTasks);

      // Assets
      if (versionInfo.assetIndex) {
        this.emit('status', 'Preparing asset downloads');
        const assetTasks = await this.prepareAssetTasks(versionInfo.assetIndex, version);
        downloadTasks.push(...assetTasks);
      }

      // Download all files concurrently
      this.emit('status', `Starting download of ${downloadTasks.length} files`);
      await this.downloadFilesConcurrently(downloadTasks, version);

      this.emit('status', 'Download completed successfully');
      this.emit('complete', version);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', new Error(`Download failed: ${errorMessage}`));
      throw error;
    }
  }

  /**
   * Prepares download tasks for libraries
   */
  private prepareLibraryTasks(libraries: any[], version: string): DownloadTask[] {
    const tasks: DownloadTask[] = [];
    const librariesDir = path.join(this.baseDir, 'libraries');

    for (const library of libraries) {
      // Main artifact
      if (library.downloads.artifact) {
        const artifactPath = path.join(librariesDir, library.downloads.artifact.path);
        tasks.push({
          url: library.downloads.artifact.url,
          destination: artifactPath,
          type: 'library',
          filename: path.basename(library.downloads.artifact.path),
          expectedHash: library.downloads.artifact.sha1,
          size: library.downloads.artifact.size
        });
      }

      // Native libraries
      if (library.downloads.classifiers) {
        const nativesDir = path.join(this.baseDir, 'natives');
        
        for (const [classifier, native] of Object.entries(library.downloads.classifiers)) {
          if (classifier.includes('natives')) {
            const nativePath = path.join(nativesDir, path.basename((native as any).path));
            tasks.push({
              url: (native as any).url,
              destination: nativePath,
              type: 'native',
              filename: path.basename((native as any).path),
              expectedHash: (native as any).sha1,
              size: (native as any).size
            });
          }
        }
      }
    }

    return tasks;
  }

  /**
   * Prepares download tasks for assets
   */
  private async prepareAssetTasks(assetIndex: any, version: string): Promise<DownloadTask[]> {
    const tasks: DownloadTask[] = [];
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

    // Prepare asset download tasks
    const assets = indexResponse.data.objects;
    for (const [assetName, asset] of Object.entries(assets)) {
      const hash = (asset as any).hash;
      const prefix = hash.substring(0, 2);
      const assetPath = path.join(objectsDir, prefix, hash);

      tasks.push({
        url: `${this.RESOURCES_URL}/${prefix}/${hash}`,
        destination: assetPath,
        type: 'asset',
        filename: assetName,
        expectedHash: hash,
        size: (asset as any).size
      });
    }

    return tasks;
  }

  /**
   * Clears the manifest cache
   */
  public clearCache(): void {
    this.manifestCache = null;
    this.manifestCacheTime = 0;
  }

  /**
   * Sets the maximum number of concurrent downloads
   */
  public setMaxConcurrentDownloads(max: number): void {
    this.MAX_CONCURRENT_DOWNLOADS = Math.max(1, Math.min(max, 50));
  }
} 