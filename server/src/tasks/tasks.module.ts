import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { LlmModule } from '../llm/llm.module';
import { EncryptionService } from '../common/encryption.service';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [LlmModule, AgentModule],
  controllers: [TasksController],
  providers: [TasksService, EncryptionService],
})
export class TasksModule {}
