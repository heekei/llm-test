import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { LlmModule } from '../llm/llm.module';
import { EncryptionService } from '../common/encryption.service';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [
    LlmModule,
    AgentModule,
    MulterModule.register({
      dest: './uploads',
    }),
  ],
  controllers: [TasksController],
  providers: [TasksService, EncryptionService],
})
export class TasksModule {}
