import config from 'config';
import { readPackageJsonSync } from '@map-colonies/read-pkg';

export const SERVICE_NAME = readPackageJsonSync().name ?? 'unknown_service';
export const DEFAULT_SERVER_PORT = 80;

export const IGNORED_OUTGOING_TRACE_ROUTES = [/^.*\/v1\/metrics.*$/];
export const IGNORED_INCOMING_TRACE_ROUTES = [/^.*\/docs.*$/];

export const INGESTION_JOB_TYPE = config.get<string>('jobManager.jobType.ingestion');
export const DELETE_JOB_TYPE = config.get<string>('jobManager.jobType.delete');

/* eslint-disable @typescript-eslint/naming-convention */
export const SERVICES: Record<string, symbol> = {
  LOGGER: Symbol('Logger'),
  CONFIG: Symbol('Config'),
  TRACER: Symbol('Tracer'),
  METER: Symbol('Meter'),
  METRICS: Symbol('Metrics'),
  JOB_MANAGER_CLIENT: Symbol('JobManagerClient'),
  JOB_SYNCER_MANAGER: Symbol('JobSyncerManager'),
  CATALOG_MANAGER: Symbol('CatalogManager'),
};
/* eslint-enable @typescript-eslint/naming-convention */
