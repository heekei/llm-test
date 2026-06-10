import { IsString } from 'class-validator';

export class AiScoreRequestDto {
  @IsString()
  judgeProviderId: string;

  @IsString()
  judgeModelId: string;
}
