import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { RunsService } from './runs.service';
import { ScoreRunDto } from './dto/score-run.dto';
import { AiScoreRequestDto } from './dto/ai-score.dto';

// Track runs currently being scored in memory
const scoringRuns = new Set<string>();

@Controller()
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @Get('runs')
  findAll(
    @Query('taskId') taskId?: string,
    @Query('providerId') providerId?: string,
    @Query('status') status?: string,
  ) {
    return this.runsService.findAll({ taskId, providerId, status });
  }

  @Get('runs/:id')
  findOne(@Param('id') id: string) {
    return this.runsService.findOne(id);
  }

  @Patch('runs/:id/score')
  score(@Param('id') id: string, @Body() dto: ScoreRunDto) {
    return this.runsService.score(id, dto);
  }

  @Get('runs/:id/ai-score-status')
  async aiScoreStatus(@Param('id') id: string) {
    const isProcessing = scoringRuns.has(id);
    if (isProcessing) return { runId: id, processing: true };

    const run = await this.runsService.findOne(id);
    return { runId: id, processing: false, aiScores: run.aiScores ?? null };
  }

  @Post('runs/:id/ai-score')
  async aiScore(@Param('id') id: string, @Body() dto: AiScoreRequestDto) {
    if (scoringRuns.has(id)) {
      return { processing: true };
    }

    scoringRuns.add(id);
    this.runsService.aiScoreBackground(id, dto).finally(() => {
      scoringRuns.delete(id);
    });

    return { runId: id, processing: true };
  }

  @Delete('runs/:id/ai-score/:index')
  async deleteAiScore(@Param('id') id: string, @Param('index') index: string) {
    return this.runsService.deleteAiScore(id, parseInt(index, 10));
  }

  @Get('tasks/:taskId/compare')
  compare(@Param('taskId') taskId: string) {
    return this.runsService.compareByTask(taskId);
  }
}
