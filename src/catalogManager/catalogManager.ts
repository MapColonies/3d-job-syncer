import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { I3DCatalogUpsertRequestBody, Link, Pycsw3DCatalogRecord } from '@map-colonies/mc-model-types';
import axios from 'axios';
import { IConfig } from '../common/interfaces';
import { DeleteJobParameters, IngestionJobParameters } from '../jobSyncerManager/interfaces';
import { SERVICES } from '../common/constants';

@injectable()
export class CatalogManager {
  private readonly catalogUrl: string;
  private readonly link: Link;

  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, @inject(SERVICES.CONFIG) private readonly config: IConfig) {
    this.catalogUrl = this.config.get<string>('catalog.url');
    this.link = this.config.get<Link>('catalog.link');
  }

  public async createCatalogMetadata(jobParameters: IngestionJobParameters): Promise<Pycsw3DCatalogRecord> {
    if (this.link.url == undefined) {
      throw new Error('link must have a url!');
    }
    const pathToTileset = jobParameters.pathToTileset.replace(/^[^/]+/, jobParameters.modelId);
    const links: Link[] = [{ ...this.link, url: `${this.link.url}/${pathToTileset}/${jobParameters.tilesetFilename}` }];
    const metadata: I3DCatalogUpsertRequestBody = {
      ...jobParameters.metadata,
      links,
      id: jobParameters.modelId,
    };

    this.logger.debug({ msg: 'Starting createCatalogMetadata', modelId: jobParameters.modelId, modelName: jobParameters.metadata.productName });
    const catalogMetadata = await axios.post<Pycsw3DCatalogRecord>(`${this.catalogUrl}/metadata`, metadata);
    this.logger.debug({
      msg: 'Finishing createCatalogMetadata',
      id: catalogMetadata.data.id,
      modelId: jobParameters.modelId,
      modelName: jobParameters.metadata.productName,
    });

    return catalogMetadata.data;
  }

  public async deleteMetadata(jobParameters: DeleteJobParameters): Promise<Pycsw3DCatalogRecord> {
    this.logger.debug({ msg: 'Starting deleteMetadata', modelId: jobParameters.modelId });
    const catalogMetadata = await axios.delete<Pycsw3DCatalogRecord>(`${this.catalogUrl}/metadata/${jobParameters.modelId}`);
    this.logger.debug({
      msg: 'Finishing deleteMetadata',
      id: catalogMetadata.data.id,
      modelId: jobParameters.modelId,
    });

    return catalogMetadata.data;
  }

  public async deleteCatalogMetadata(id: string): Promise<void> {
    await axios.delete(`${this.catalogUrl}/metadata/${id}`);
  }
}
