import { Layer3DMetadata } from '@map-colonies/mc-model-types';
import { IJobResponse, OperationStatus } from '@map-colonies/mc-priority-queue';
import { randBoolean, randNumber, randSentence, randUuid, randWord } from '@ngneat/falso';
import { DeleteJobParameters, IngestionJobParameters, ITaskParameters } from '../../src/jobSyncerManager/interfaces';
import { DELETE_JOB_TYPE, INGESTION_JOB_TYPE } from '../../src/common/constants';

const maxTaskCount = 10;
const maxJobsNumber = 5;

export const jobManagerClientMock = {
  getJobs: jest.fn(),
  updateJob: jest.fn(),
};

export const createIngestionJobParameters = (): IngestionJobParameters => {
  return {
    metadata: {} as Layer3DMetadata,
    modelId: randUuid(),
    tilesetFilename: randUuid(),
    filesCount: randNumber(),
    pathToTileset: `${randWord()}/${randWord()}`,
  };
};

export const createDeleteJobParameters = (): DeleteJobParameters => {
  return {
    modelId: randUuid(),
    pathToTileset: `${randWord()}/${randWord()}`,
    filesCount: randNumber(),
  };
};

export const createIngestionJob = (allTasksCompleted = false, hasFailedTasks = false): IJobResponse<IngestionJobParameters, ITaskParameters> => {
  const completedTasks = randNumber({ min: 1, max: maxTaskCount - 1 });
  const taskCount = allTasksCompleted ? completedTasks : randNumber({ min: completedTasks + 1, max: maxTaskCount });
  const failedTasks = hasFailedTasks ? taskCount - completedTasks : 0;
  const inProgressTasks = taskCount - completedTasks - failedTasks;
  const pendingTasks = taskCount - completedTasks - failedTasks - inProgressTasks;
  return {
    id: randUuid(),
    completedTasks,
    taskCount,
    failedTasks,
    inProgressTasks,
    pendingTasks,
    status: OperationStatus.IN_PROGRESS,
    resourceId: randUuid(),
    version: randWord(),
    type: INGESTION_JOB_TYPE,
    description: randSentence(),
    parameters: createIngestionJobParameters(),
    reason: randSentence(),
    created: randWord(),
    updated: randWord(),
    percentage: randNumber(),
    isCleaned: false,
    priority: randNumber(),
    expiredTasks: 0,
    abortedTasks: 0,
    domain: randWord(),
  };
};

export const createDeleteJob = (allTasksCompleted = false, hasFailedTasks = false): IJobResponse<DeleteJobParameters, ITaskParameters> => {
  const completedTasks = randNumber({ min: 1, max: maxTaskCount - 1 });
  const taskCount = allTasksCompleted ? completedTasks : randNumber({ min: completedTasks + 1, max: maxTaskCount });
  const failedTasks = hasFailedTasks ? taskCount - completedTasks : 0;
  const inProgressTasks = taskCount - completedTasks - failedTasks;
  const pendingTasks = taskCount - completedTasks - failedTasks - inProgressTasks;
  return {
    id: randUuid(),
    completedTasks,
    taskCount,
    failedTasks,
    inProgressTasks,
    pendingTasks,
    status: OperationStatus.IN_PROGRESS,
    resourceId: randUuid(),
    version: randWord(),
    type: DELETE_JOB_TYPE,
    description: randSentence(),
    parameters: createDeleteJobParameters(),
    reason: randSentence(),
    created: randWord(),
    updated: randWord(),
    percentage: randNumber(),
    isCleaned: false,
    priority: randNumber(),
    expiredTasks: 0,
    abortedTasks: 0,
    domain: randWord(),
  };
};

export const createIngestionJobs = (
  jobsAmount = randNumber({ min: 1, max: maxJobsNumber })
): IJobResponse<IngestionJobParameters, ITaskParameters>[] => {
  const jobs: IJobResponse<IngestionJobParameters, ITaskParameters>[] = [];
  for (let index = 1; index < jobsAmount; index++) {
    jobs.push(createIngestionJob(randBoolean()));
  }
  return jobs;
};

export const createDeleteJobs = (jobsAmount = randNumber({ min: 1, max: maxJobsNumber })): IJobResponse<DeleteJobParameters, ITaskParameters>[] => {
  const jobs: IJobResponse<DeleteJobParameters, ITaskParameters>[] = [];
  for (let index = 1; index < jobsAmount; index++) {
    jobs.push(createDeleteJob(randBoolean()));
  }
  return jobs;
};
