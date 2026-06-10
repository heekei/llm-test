import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { RunTaskDto } from './dto/run-task.dto';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findAll() {
    return this.tasksService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateTaskDto) {
    return this.tasksService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }

  // POST + SSE: manually write SSE-format chunks to support a request body
  @Post(':id/run')
  run(@Param('id') id: string, @Body() dto: RunTaskDto, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const subscription = this.tasksService.runTaskStream(id, dto.targets);
    const sub = subscription.subscribe({
      next: (event) => {
        res.write(`data: ${event.data}\n\n`);
      },
      error: (err) => {
        res.write(
          `data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`,
        );
        res.end();
      },
      complete: () => {
        res.end();
      },
    });

    res.on('close', () => {
      sub.unsubscribe();
    });
  }
}
