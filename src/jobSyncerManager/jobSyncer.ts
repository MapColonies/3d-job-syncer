import { Logger } from '@map-colonies/js-logger';
import { Pycsw3DCatalogRecord } from '@map-colonies/mc-model-types';
import { IFindJobsRequest, IJobResponse, IUpdateJobBody, JobManagerClient, OperationStatus } from '@map-colonies/mc-priority-queue';
import { IConfig } from 'config';
import { inject, injectable } from 'tsyringe';
import { CatalogManager } from '../catalogManager/catalogManager';
import { DELETE_JOB_TYPE, INGESTION_JOB_TYPE, SERVICES } from '../common/constants';
import { DeleteJobParameters, IngestionJobParameters, ITaskParameters } from '../jobSyncerManager/interfaces';

@injectable()
export class JobSyncerManager {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.JOB_MANAGER_CLIENT) private readonly jobManagerClient: JobManagerClient,
    @inject(SERVICES.CATALOG_MANAGER) private readonly catalogManagerClient: CatalogManager
  ) {}

  public async progressJobs(): Promise<void> {
    this.logger.debug({ msg: 'Starting job syncer' });
    const ingestionJobs = await this.getIngestionInProgressJobs();
    const deleteJobs = await this.getDeleteInProgressJobs();
    const jobs: IJobResponse<IngestionJobParameters | DeleteJobParameters, ITaskParameters>[] = [...ingestionJobs, ...deleteJobs];

    let catalogMetadata: Pycsw3DCatalogRecord | null = null;

    for (const job of jobs) {
      let reason: string | null = null;
      let isCreateCatalogSuccess = true;
      const isJobCompleted = job.completedTasks === job.taskCount;

      try {
        if (isJobCompleted) {
          if (job.type === INGESTION_JOB_TYPE) {
            catalogMetadata = await this.catalogManagerClient.createCatalogMetadata(
              (job as IJobResponse<IngestionJobParameters, ITaskParameters>).parameters
            );
            this.logger.info({
              msg: `Ingestion Job: ${job.id} is completed`,
              modelId: job.parameters.modelId,
              modelName: job.productName,
            });
          } else if (job.type === DELETE_JOB_TYPE) {
            catalogMetadata = await this.catalogManagerClient.deleteMetadata((job as IJobResponse<DeleteJobParameters, ITaskParameters>).parameters);
            this.logger.info({
              msg: `Delete Job: ${job.id} is completed`,
              modelId: job.parameters.modelId,
              modelName: job.productName,
            });
          }
        }
      } catch (error) {
        this.logger.error({ msg: error, modelId: job.parameters.modelId, modelName: job.productName });
        isCreateCatalogSuccess = false;
        reason = (error as Error).message;
      }

      const status = this.getStatus(job, isJobCompleted, isCreateCatalogSuccess);
      const payload = this.buildPayload(job, status, reason);

      try {
        await this.handleUpdateJob(job.id, payload);
      } catch (error) {
        await this.handleUpdateJobRejection(error, catalogMetadata);
      }

      this.logger.debug({
        msg: 'Finished job syncer',
        jobId: job.id,
        modelId: job.resourceId,
        payload,
      });
    }
  }

  public async handleUpdateJobRejection(error: unknown, catalogMetadata: Pycsw3DCatalogRecord | null): Promise<void> {
    if (catalogMetadata?.id !== undefined) {
      await this.catalogManagerClient.deleteCatalogMetadata(catalogMetadata.id);
    }

    if (error instanceof Error) {
      this.logger.error({ error, msg: 'Failed to updateJob', stack: error.stack });
      throw error;
    }
  }
  private async getIngestionInProgressJobs(): Promise<IJobResponse<IngestionJobParameters, ITaskParameters>[]> {
    const queryParams: IFindJobsRequest = {
      status: OperationStatus.IN_PROGRESS,
      type: INGESTION_JOB_TYPE,
      shouldReturnTasks: false,
    };

    this.logger.debug({ msg: 'Starting getIngestionInProgressJobs', queryParams });
    const jobs = await this.jobManagerClient.getJobs<IngestionJobParameters, ITaskParameters>(queryParams);
    this.logger.debug({ msg: 'Finishing getIngestionInProgressJobs', count: jobs.length });
    return jobs;
  }

  private async getDeleteInProgressJobs(): Promise<IJobResponse<DeleteJobParameters, ITaskParameters>[]> {
    const queryParams: IFindJobsRequest = {
      status: OperationStatus.IN_PROGRESS,
      type: DELETE_JOB_TYPE,
      shouldReturnTasks: false,
    };

    this.logger.debug({ msg: 'Starting getDeleteInProgressJobs', queryParams });
    const jobs = await this.jobManagerClient.getJobs<DeleteJobParameters, ITaskParameters>(queryParams);
    this.logger.debug({ msg: 'Finishing getDeleteInProgressJobs', count: jobs.length });
    return jobs;
  }

  private async handleUpdateJob(jobId: string, payload: IUpdateJobBody<IngestionJobParameters | DeleteJobParameters>): Promise<void> {
    this.logger.debug({ msg: 'Starting updateJob', jobId });
    await this.jobManagerClient.updateJob<IngestionJobParameters | DeleteJobParameters>(jobId, payload);
    this.logger.debug({ msg: 'Done updateJob', jobId });
  }

  private buildPayload(
    job: IJobResponse<IngestionJobParameters | DeleteJobParameters, ITaskParameters>,
    status: OperationStatus,
    reason: string | null
  ): IUpdateJobBody<IngestionJobParameters | DeleteJobParameters> {
    const payload: IUpdateJobBody<IngestionJobParameters | DeleteJobParameters> = {
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      percentage: parseInt(((job.completedTasks / job.taskCount) * 100).toString()),
      status,
    };

    if (reason !== null) {
      payload.reason = reason;
    }

    return payload;
  }

  private getStatus(
    job: IJobResponse<IngestionJobParameters | DeleteJobParameters, ITaskParameters>,
    isJobCompleted: boolean,
    isCreateCatalogSuccess: boolean
  ): OperationStatus {
    const isJobNeedToFail = job.failedTasks > 0 && job.inProgressTasks === 0 && job.pendingTasks === 0;

    if (!isCreateCatalogSuccess || isJobNeedToFail) {
      return OperationStatus.FAILED;
    }

    if (isJobCompleted) {
      return OperationStatus.COMPLETED;
    }

    return OperationStatus.IN_PROGRESS;
  }
}
