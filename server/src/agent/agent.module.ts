import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { AgentService } from './agent.service';
import { DockerService } from './docker.service';
import { ToolRegistryService } from './tools/tool-registry.service';

@Module({
  imports: [LlmModule],
  providers: [AgentService, DockerService, ToolRegistryService],
  exports: [AgentService, DockerService, ToolRegistryService],
})
export class AgentModule {}
