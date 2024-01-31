import { Layer3DMetadata } from '@map-colonies/mc-model-types';

export interface IngestionJobParameters {
  metadata: Layer3DMetadata;
  modelId: string;
  tilesetFilename: string;
  filesCount: number;
  pathToTileset: string;
}

export interface DeleteJobParameters {
  modelId: string;
  pathToTileset: string;
  filesCount: number;
}

export interface ITaskParameters {
  paths: string[];
  modelId: string;
}

export interface JobManagerConfig {
  url: string;
  jobType: string;
}
