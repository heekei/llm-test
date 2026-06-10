import { Module } from '@nestjs/common';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';
import { EncryptionService } from '../common/encryption.service';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [LlmModule],
  controllers: [RunsController],
  providers: [RunsService, EncryptionService],
})
export class RunsModule {}
