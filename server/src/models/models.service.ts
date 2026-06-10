import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { AdapterFactory } from '../llm/factories/adapter.factory';
import { Logger } from '@nestjs/common';

@Injectable()
export class ModelsService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private adapterFactory: AdapterFactory,
  ) {}

  async fetchAndCacheModels(providerId: string) {
    const provider = await this.prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider) throw new NotFoundException(`供应商 ${providerId} 未找到`);

    const adapter = this.adapterFactory.get(provider.adapterType);
    const apiKey = this.encryption.decrypt(provider.apiKey);

    let modelIds: string[];
    try {
      modelIds = await adapter.listModels(provider.apiBaseUrl, apiKey);
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      Logger.error(`获取模型列表失败 provider=${provider.name}: ${msg}`);

      // Classify error type for a friendlier message
      if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
        throw new BadRequestException(`无法连接到 ${provider.name} 的API地址，请检查 API Base URL 是否正确`);
      }
      if (msg.includes('401') || msg.includes('403')) {
        throw new BadRequestException(`${provider.name} API密钥无效或未授权，请检查 API Key`);
      }
      throw new BadRequestException(`获取 ${provider.name} 模型列表失败: ${msg}`);
    }

    if (modelIds.length === 0) {
      Logger.warn(`Provider ${provider.name} 返回了空的模型列表，可能API端点不支持`);
      return [];
    }

    Logger.log(`Provider ${provider.name}: 获取到 ${modelIds.length} 个模型`);

    // Upsert models
    const models = await Promise.all(
      modelIds.map((modelId) =>
        this.prisma.model.upsert({
          where: { providerId_modelId: { providerId, modelId } },
          create: { providerId, modelId, name: modelId },
          update: { name: modelId },
        }),
      ),
    );

    // Remove stale models
    await this.prisma.model.deleteMany({
      where: { providerId, modelId: { notIn: modelIds } },
    });

    return models;
  }

  async getCachedModels(providerId: string) {
    return this.prisma.model.findMany({ where: { providerId }, orderBy: { name: 'asc' } });
  }

  async getAllCachedModels() {
    return this.prisma.model.findMany({
      orderBy: [{ providerId: 'asc' }, { name: 'asc' }],
      include: { provider: { select: { id: true, name: true, adapterType: true } } },
    });
  }
}
