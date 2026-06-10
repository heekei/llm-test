import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { CreateProviderDto, UpdateProviderDto } from './dto/provider.dto';

@Injectable()
export class ProvidersService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  async findAll() {
    const providers = await this.prisma.provider.findMany({ orderBy: { createdAt: 'desc' } });
    return providers.map((p) => ({
      ...p,
      apiKey: this.encryption.maskApiKey(p.apiKey),
    }));
  }

  async findOne(id: string) {
    const provider = await this.prisma.provider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException(`Provider ${id} not found`);
    return { ...provider, apiKey: this.encryption.maskApiKey(provider.apiKey) };
  }

  async create(dto: CreateProviderDto) {
    const encryptedKey = this.encryption.encrypt(dto.apiKey);
    const provider = await this.prisma.provider.create({
      data: { ...dto, apiKey: encryptedKey },
    });
    return { ...provider, apiKey: this.encryption.maskApiKey(encryptedKey) };
  }

  async update(id: string, dto: UpdateProviderDto) {
    await this.findOne(id);
    const data: any = { ...dto };
    if (dto.apiKey) {
      data.apiKey = this.encryption.encrypt(dto.apiKey);
    }
    const provider = await this.prisma.provider.update({ where: { id }, data });
    return { ...provider, apiKey: this.encryption.maskApiKey(provider.apiKey) };
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.provider.delete({ where: { id } });
  }

  async getDecryptedApiKey(id: string): Promise<string> {
    const provider = await this.prisma.provider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException(`Provider ${id} not found`);
    return this.encryption.decrypt(provider.apiKey);
  }
}
