import { Module } from '@nestjs/common';
import { ModelsController } from './models.controller';
import { ModelsService } from './models.service';
import { LlmModule } from '../llm/llm.module';
import { EncryptionService } from '../common/encryption.service';

@Module({
  imports: [LlmModule],
  controllers: [ModelsController],
  providers: [ModelsService, EncryptionService],
  exports: [ModelsService],
})
export class ModelsModule {}
