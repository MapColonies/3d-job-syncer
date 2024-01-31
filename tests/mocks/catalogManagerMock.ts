import { Pycsw3DCatalogRecord } from '@map-colonies/mc-model-types';
import { randUuid } from '@ngneat/falso';

export const catalogManagerClientMock = {
  createCatalogMetadata: jest.fn(),
  deleteCatalogMetadata: jest.fn(),
  deleteMetadata: jest.fn(),
};

export const createFakeMetadata: Pycsw3DCatalogRecord = {
  id: randUuid(),
} as Pycsw3DCatalogRecord;
