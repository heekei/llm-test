import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DefaultTargetInput {
  @IsString()
  providerId: string;

  @IsString()
  providerName: string;

  @IsString()
  modelId: string;
}

export class CreateTaskDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsString()
  prompt: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTokens?: number;

  @IsOptional()
  @IsNumber()
  @Min(1024)
  thinkingBudgetTokens?: number;

  @IsOptional()
  @IsString()
  reasoningEffort?: string;

  @IsOptional()
  @IsString()
  @IsIn(['simple', 'agentic'])
  mode?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tools?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  maxIterations?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(3600)
  agentTimeoutSec?: number;

  @IsOptional()
  @IsString()
  dockerImage?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DefaultTargetInput)
  defaultTargets?: DefaultTargetInput[];
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsNumber()
  maxTokens?: number;

  @IsOptional()
  @IsNumber()
  thinkingBudgetTokens?: number;

  @IsOptional()
  @IsString()
  reasoningEffort?: string;

  @IsOptional()
  @IsString()
  @IsIn(['simple', 'agentic'])
  mode?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tools?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  maxIterations?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(3600)
  agentTimeoutSec?: number;

  @IsOptional()
  @IsString()
  dockerImage?: string;
}
