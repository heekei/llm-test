import { IsString, IsUrl, IsIn, IsOptional, IsBoolean } from 'class-validator';

export class CreateProviderDto {
  @IsString()
  name: string;

  @IsString()
  apiBaseUrl: string;

  @IsString()
  apiKey: string;

  @IsIn(['openai', 'anthropic'])
  adapterType: 'openai' | 'anthropic';

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateProviderDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  apiBaseUrl?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsIn(['openai', 'anthropic'])
  adapterType?: 'openai' | 'anthropic';

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
