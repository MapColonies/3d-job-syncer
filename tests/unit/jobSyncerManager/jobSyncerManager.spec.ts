import { container } from 'tsyringe';
import { IUpdateJobBody, OperationStatus } from '@map-colonies/mc-priority-queue';
import jsLogger from '@map-colonies/js-logger';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { JobSyncerManager } from '../../../src/jobSyncerManager/jobSyncer';
import { createIngestionJob, createIngestionJobs, jobManagerClientMock, createDeleteJob, createDeleteJobs } from '../../mocks/jobManagerMock';
import { catalogManagerClientMock, createFakeMetadata } from '../../mocks/catalogManagerMock';
import { DeleteJobParameters, IngestionJobParameters } from '../../../src/jobSyncerManager/interfaces';

describe('jobSyncerManager', () => {
  let jobSyncerManager: JobSyncerManager;

  beforeAll(() => {
    getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.JOB_MANAGER_CLIENT, provider: { useValue: jobManagerClientMock } },
        { token: SERVICES.CATALOG_MANAGER, provider: { useValue: catalogManagerClientMock } },
      ],
    });
  });

  beforeEach(() => {
    jobSyncerManager = container.resolve(JobSyncerManager);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('progressJobs-ingestionJobs', () => {
    it('When does not have in-progress jobs, should do nothing', async () => {
      jobManagerClientMock.getJobs.mockResolvedValue([]);
      jobManagerClientMock.updateJob.mockResolvedValue(undefined);

      await jobSyncerManager.progressJobs();

      expect(jobManagerClientMock.updateJob).not.toHaveBeenCalled();
      expect(catalogManagerClientMock.createCatalogMetadata).not.toHaveBeenCalled();
      expect(jobManagerClientMock.getJobs).toHaveBeenCalled();
    });

    it('When has in-progress job, should progress them and update job-manager', async () => {
      const ingestionJobs = createIngestionJobs();

      jobManagerClientMock.getJobs.mockResolvedValueOnce(ingestionJobs);
      jobManagerClientMock.updateJob.mockResolvedValueOnce(undefined);

      await jobSyncerManager.progressJobs();

      expect(jobManagerClientMock.getJobs).toHaveBeenCalled();
      expect(jobManagerClientMock.updateJob).toHaveBeenCalledTimes(ingestionJobs.length);
    });

    it('When has completed job, it should insert the metadata to the catalog service', async () => {
      const job = createIngestionJob(true);
      jobManagerClientMock.getJobs.mockResolvedValue([job]);
      jobManagerClientMock.updateJob.mockResolvedValue(undefined);
      catalogManagerClientMock.createCatalogMetadata.mockResolvedValue(createFakeMetadata);

      await jobSyncerManager.progressJobs();

      expect(jobManagerClientMock.getJobs).toHaveBeenCalled();
      expect(jobManagerClientMock.updateJob).toHaveBeenCalled();
      expect(catalogManagerClientMock.createCatalogMetadata).toHaveBeenCalled();
    });

    it('When has completed job but catalog failed to create metadata, the job will update with failed status', async () => {
      const job = createIngestionJob(true);
      jobManagerClientMock.getJobs.mockResolvedValue([job]);
      jobManagerClientMock.updateJob.mockResolvedValue(undefined);
      catalogManagerClientMock.createCatalogMetadata.mockRejectedValue(new Error('problem'));

      const payload: IUpdateJobBody<IngestionJobParameters> = {
        percentage: 100,
        status: OperationStatus.FAILED,
        reason: 'problem',
      };

      await jobSyncerManager.progressJobs();

      expect(jobManagerClientMock.getJobs).toHaveBeenCalled();
      expect(jobManagerClientMock.updateJob).toHaveBeenLastCalledWith(job.id, payload);
    });

    it('When updated catalog but failed to update job-manager, the catalog metadata will be removed', async () => {
      const job = createIngestionJob(true);
      jobManagerClientMock.getJobs.mockResolvedValue([job]);
      jobManagerClientMock.updateJob.mockRejectedValue(new Error('problem'));
      catalogManagerClientMock.createCatalogMetadata.mockResolvedValue(createFakeMetadata);
      catalogManagerClientMock.deleteCatalogMetadata.mockResolvedValue(undefined);

      await expect(jobSyncerManager.progressJobs()).rejects.toThrow('problem');

      expect(jobManagerClientMock.getJobs).toHaveBeenCalled();
      expect(catalogManagerClientMock.createCatalogMetadata).toHaveBeenCalled();
      expect(catalogManagerClientMock.deleteCatalogMetadata).toHaveBeenCalled();
    });
  });
  describe('progressJobs-deleteJobs', () => {
    it('When does not have in-progress jobs, should do nothing', async () => {
      jobManagerClientMock.getJobs.mockResolvedValue([]);
      jobManagerClientMock.updateJob.mockResolvedValue(undefined);

      await jobSyncerManager.progressJobs();

      expect(jobManagerClientMock.updateJob).not.toHaveBeenCalled();
      expect(catalogManagerClientMock.createCatalogMetadata).not.toHaveBeenCalled();
      expect(catalogManagerClientMock.deleteMetadata).not.toHaveBeenCalled();
      catalogManagerClientMock.deleteCatalogMetadata.mockResolvedValue(undefined);
      expect(jobManagerClientMock.getJobs).toHaveBeenCalled();
    });

    it('When has in-progress job, should progress them and update job-manager', async () => {
      const deleteJobs = createDeleteJobs();
      jobManagerClientMock.getJobs.mockResolvedValueOnce(deleteJobs);
      jobManagerClientMock.updateJob.mockResolvedValueOnce(undefined);

      await jobSyncerManager.progressJobs();

      expect(jobManagerClientMock.getJobs).toHaveBeenCalled();
      expect(jobManagerClientMock.updateJob).toHaveBeenCalledTimes(deleteJobs.length);
    });

    it('When has completed delete job but catalog failed to delete metadata, the job will update with failed status', async () => {
      const deleteJob = createDeleteJob(true);
      jobManagerClientMock.getJobs.mockResolvedValue([deleteJob]);
      jobManagerClientMock.updateJob.mockResolvedValue(undefined);
      catalogManagerClientMock.deleteCatalogMetadata.mockResolvedValue(undefined);
      catalogManagerClientMock.deleteMetadata.mockRejectedValue(new Error('problem'));

      const payload: IUpdateJobBody<DeleteJobParameters> = {
        percentage: 100,
        status: OperationStatus.FAILED,
        reason: 'problem',
      };

      await jobSyncerManager.progressJobs();

      expect(jobManagerClientMock.getJobs).toHaveBeenCalled();
      expect(jobManagerClientMock.updateJob).toHaveBeenLastCalledWith(deleteJob.id, payload);
    });

    it('When updated catalog but failed to update job-manager, the catalog metadata will not be deleted', async () => {
      const deleteJob = createDeleteJob(true);
      jobManagerClientMock.getJobs.mockResolvedValue([deleteJob]);
      jobManagerClientMock.updateJob.mockRejectedValue(new Error('problem'));
      catalogManagerClientMock.deleteCatalogMetadata.mockResolvedValue(undefined);
      catalogManagerClientMock.deleteMetadata.mockResolvedValue(undefined);

      await expect(jobSyncerManager.progressJobs()).rejects.toThrow('problem');
      expect(jobManagerClientMock.getJobs).toHaveBeenCalled();
      expect(catalogManagerClientMock.deleteCatalogMetadata).not.toHaveBeenCalled();
    });
  });
});
