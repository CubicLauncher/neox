

export interface MinecraftVersion {
  id: string;
  type: 'release' | 'snapshot';
  url: string;
  time: string;
  releaseTime: string;
  downloads: {
    client: {
      url: string;
      sha1: string;
      size: number;
    };
  };
  assetIndex: {
    id: string;
    url: string;
    sha1: string;
    size: number;
  };
  libraries: MinecraftLibrary[];
}

export interface MinecraftAsset {
  hash: string;
  size: number;
}

export interface MinecraftLibrary {
  name: string;
  downloads: {
    artifact?: {
      path: string;
      url: string;
      sha1: string;
      size: number;
    };
    classifiers?: {
      [key: string]: {
        path: string;
        url: string;
        sha1: string;
        size: number;
      };
    };
  };
  rules?: {
    action: 'allow' | 'disallow';
    os?: {
      name?: string;
      version?: string;
      arch?: string;
    };
  }[];
}

export interface VersionManifest {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: MinecraftVersion[];
}

export interface DownloadOptions {
  version: string;
  directory: string;
  progressCallback?: (progress: number, total: number, type: string) => void;
}