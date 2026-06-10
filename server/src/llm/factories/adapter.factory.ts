import { Injectable } from '@nestjs/common';
import { OpenAiAdapter } from '../adapters/openai.adapter';
import { AnthropicAdapter } from '../adapters/anthropic.adapter';
import { LlmAdapter } from '../adapters/adapter.interface';

@Injectable()
export class AdapterFactory {
  constructor(
    private readonly openaiAdapter: OpenAiAdapter,
    private readonly anthropicAdapter: AnthropicAdapter,
  ) {}

  get(adapterType: string): LlmAdapter {
    switch (adapterType) {
      case 'openai':
        return this.openaiAdapter;
      case 'anthropic':
        return this.anthropicAdapter;
      default:
        throw new Error(`Unknown adapter type: ${adapterType}`);
    }
  }
}
