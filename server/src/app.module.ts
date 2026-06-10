import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProvidersModule } from './providers/providers.module';
import { ModelsModule } from './models/models.module';
import { TasksModule } from './tasks/tasks.module';
import { RunsModule } from './runs/runs.module';
import { LlmModule } from './llm/llm.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ProvidersModule,
    ModelsModule,
    TasksModule,
    RunsModule,
    LlmModule,
  ],
})
export class AppModule {}
