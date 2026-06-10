import { Module } from '@nestjs/common';
import { OpenAiAdapter } from './adapters/openai.adapter';
import { AnthropicAdapter } from './adapters/anthropic.adapter';
import { AdapterFactory } from './factories/adapter.factory';

@Module({
  providers: [OpenAiAdapter, AnthropicAdapter, AdapterFactory],
  exports: [AdapterFactory],
})
export class LlmModule {}
