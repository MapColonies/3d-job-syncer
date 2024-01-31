import { container } from 'tsyringe';
import jsLogger from '@map-colonies/js-logger';
import mockAxios from 'jest-mock-axios';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { Pycsw3DCatalogRecord } from '@map-colonies/mc-model-types';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { JobSyncerManager } from '../../../src/jobSyncerManager/jobSyncer';
import { createDeleteJob, createIngestionJob, jobManagerClientMock, createDeleteJobs, createIngestionJobs } from '../../mocks/jobManagerMock';
import { createFakeMetadata } from '../../mocks/catalogManagerMock';

describe('jobSyncerManager', () => {
  let jobSyncerManager: JobSyncerManager;

  beforeAll(() => {
    getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.JOB_MANAGER_CLIENT, provider: { useValue: jobManagerClientMock } },
      ],
    });

    jobSyncerManager = container.resolve(JobSyncerManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockAxios.reset();
  });

  describe('progressJobs-ingestion', () => {
    it('should insert metadata to the catalog service when an ingestion tasks of ingestion job is completed', async () => {
      const ingestionJobs = createIngestionJobs();
      ingestionJobs.push(createIngestionJob(true));

      jobManagerClientMock.getJobs.mockResolvedValue(ingestionJobs);
      jobManagerClientMock.updateJob.mockResolvedValue(undefined);
      const metadata = createFakeMetadata;
      mockAxios.post.mockResolvedValue({ data: metadata });
      const completedJobsCount = ingestionJobs.filter((job) => job.completedTasks === job.taskCount).length;

      console.log('Ingestion Jobs Length:', ingestionJobs.length);

      await jobSyncerManager.progressJobs();

      console.log(' Calls:', jobManagerClientMock.updateJob.mock.calls.length);

      expect(jobManagerClientMock.updateJob).toHaveBeenCalledTimes(2 * ingestionJobs.length);
      expect(mockAxios.post).toHaveBeenCalledTimes(2 * completedJobsCount);
    });

    it('When there is a problem with the catalog, it should update the job-manager', async () => {
      const ingestionJobs = createIngestionJobs();
      ingestionJobs.push(createIngestionJob(true));
      const completedJobsPosition: number[] = [];
      for (let index = 0; index < ingestionJobs.length; index++) {
        if (ingestionJobs[index].completedTasks === ingestionJobs[index].taskCount) {
          completedJobsPosition.push(index);
        }
      }
      jobManagerClientMock.getJobs.mockResolvedValue(ingestionJobs);
      jobManagerClientMock.updateJob.mockResolvedValue(undefined);
      mockAxios.post.mockRejectedValue(new Error('problem'));
      const payload = {
        percentage: 100,
        reason: 'problem',
        status: OperationStatus.FAILED,
      };

      await jobSyncerManager.progressJobs();

      expect(jobManagerClientMock.getJobs).toHaveBeenCalled();
      expect(jobManagerClientMock.updateJob).toHaveBeenCalledTimes(2 * ingestionJobs.length);
      for (let index = 0; index < completedJobsPosition.length; index++) {
        expect(jobManagerClientMock.updateJob).toHaveBeenNthCalledWith(
          completedJobsPosition[index] + 1,
          ingestionJobs[completedJobsPosition[index]].id,
          payload
        );
      }
    });

    it('should handle completed ingestion job with failed catalog metadata creation', async () => {
      const ingestionJob = createIngestionJob(true);
      jobManagerClientMock.getJobs.mockResolvedValue([ingestionJob]);
      jobManagerClientMock.updateJob.mockResolvedValue(undefined);
      mockAxios.post.mockRejectedValue(new Error('Catalog error'));

      await jobSyncerManager.progressJobs();

      expect(jobManagerClientMock.getJobs).toHaveBeenCalled();
      expect(jobManagerClientMock.updateJob).toHaveBeenCalledWith(ingestionJob.id, expect.objectContaining({ status: OperationStatus.FAILED }));
      expect(mockAxios.delete).not.toHaveBeenCalled();
    });
  });

  describe('progressJobs-delete', () => {
    it('When has completed delete job, it should delete metadata from catalog service', async () => {
      const deleteJobs = createDeleteJobs();
      deleteJobs.push(createDeleteJob(true));
      jobManagerClientMock.getJobs.mockResolvedValue(deleteJobs);
      jobManagerClientMock.updateJob.mockResolvedValue(undefined);
      const metadata = createFakeMetadata;

      mockAxios.delete.mockResolvedValue({ data: metadata });
      const completedJobsCount = deleteJobs.filter((job) => job.completedTasks === job.taskCount).length;
      await jobSyncerManager.progressJobs();

      expect(jobManagerClientMock.getJobs).toHaveBeenCalled();
      expect(jobManagerClientMock.updateJob).toHaveBeenCalledTimes(2 * deleteJobs.length);
      expect(mockAxios.delete).toHaveBeenCalledTimes(2 * completedJobsCount);
    });

    it('When there is a problem with the catalog, it should update the job-manager', async () => {
      const deleteJobs = createDeleteJobs();
      deleteJobs.push(createIngestionJob(true));
      const completedJobsPosition: number[] = [];
      for (let index = 0; index < deleteJobs.length; index++) {
        if (deleteJobs[index].completedTasks === deleteJobs[index].taskCount) {
          completedJobsPosition.push(index);
        }
      }
      jobManagerClientMock.getJobs.mockResolvedValue(deleteJobs);
      jobManagerClientMock.updateJob.mockResolvedValue(undefined);
      mockAxios.delete.mockRejectedValue(new Error('Catalog error'));
      const payload = {
        percentage: 100,
        reason: 'Catalog error',
        status: OperationStatus.FAILED,
      };

      await jobSyncerManager.progressJobs();

      expect(jobManagerClientMock.getJobs).toHaveBeenCalled();
      expect(jobManagerClientMock.updateJob).toHaveBeenCalledTimes(2 * deleteJobs.length);
      for (let index = 0; index < completedJobsPosition.length; index++) {
        expect(jobManagerClientMock.updateJob).toHaveBeenNthCalledWith(
          completedJobsPosition[index] + 1,
          deleteJobs[completedJobsPosition[index]].id,
          payload
        );
      }
    });

    it('should handle completed delete job with failed catalog metadata deletion', async () => {
      const deleteJob = createDeleteJob(true);
      jobManagerClientMock.getJobs.mockResolvedValue([deleteJob]);
      jobManagerClientMock.updateJob.mockResolvedValue(undefined);
      mockAxios.delete.mockRejectedValue(new Error('Catalog deletion error'));

      await jobSyncerManager.progressJobs();

      expect(jobManagerClientMock.getJobs).toHaveBeenCalled();
      expect(jobManagerClientMock.updateJob).toHaveBeenCalledWith(deleteJob.id, expect.objectContaining({ status: OperationStatus.FAILED }));
      expect(mockAxios.delete).toHaveBeenCalled();
    });

    it('should delete catalog metadata and rethrow error when error is an instance of Error', async () => {
      const error = new Error('Catalog deletion error');
      const catalogMetadata = { id: 'testCatalogId' } as Pycsw3DCatalogRecord;

      await expect(jobSyncerManager.handleUpdateJobRejection(error, catalogMetadata)).rejects.toThrow(error);
    });

    it('should not delete catalog metadata when catalogMetadata is null', async () => {
      // Arrange
      const error = new Error('Test error');
      const catalogMetadata = null;

      await expect(jobSyncerManager.handleUpdateJobRejection(error, catalogMetadata)).rejects.toThrow(error);
      expect(mockAxios.delete).not.toHaveBeenCalled();
    });

    it('should not delete catalog metadata when catalogMetadata.id is undefined', async () => {
      const error = new Error('Test error');
      const catalogMetadata = { id: undefined } as Pycsw3DCatalogRecord;

      await expect(jobSyncerManager.handleUpdateJobRejection(error, catalogMetadata)).rejects.toThrow(error);
      expect(mockAxios.delete).not.toHaveBeenCalled();
    });
  });
});
