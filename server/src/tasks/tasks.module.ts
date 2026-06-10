import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { LlmModule } from '../llm/llm.module';
import { EncryptionService } from '../common/encryption.service';

@Module({
  imports: [LlmModule],
  controllers: [TasksController],
  providers: [TasksService, EncryptionService],
})
export class TasksModule {}
