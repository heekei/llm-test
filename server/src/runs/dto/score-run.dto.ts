import { IsInt, Min, Max, IsOptional, IsString } from 'class-validator';

export class ScoreRunDto {
  @IsInt()
  @Min(1)
  @Max(5)
  score: number;

  @IsOptional()
  @IsString()
  scoreNote?: string;
}
