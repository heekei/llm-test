import { Controller, Get, Post, Param } from '@nestjs/common';
import { ModelsService } from './models.service';

@Controller()
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  // Fetch models from provider API and cache
  @Post('providers/:providerId/models/fetch')
  fetchModels(@Param('providerId') providerId: string) {
    return this.modelsService.fetchAndCacheModels(providerId);
  }

  // Get cached models for a provider
  @Get('providers/:providerId/models')
  getProviderModels(@Param('providerId') providerId: string) {
    return this.modelsService.getCachedModels(providerId);
  }

  // Get all cached models across all providers
  @Get('models')
  getAllModels() {
    return this.modelsService.getAllCachedModels();
  }
}
