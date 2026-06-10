import { IsArray, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class RunTargetDto {
  @IsString()
  providerId: string;

  @IsString()
  modelId: string;
}

export class RunTaskDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RunTargetDto)
  targets: RunTargetDto[];
}
