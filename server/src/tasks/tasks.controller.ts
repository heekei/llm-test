import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { RunTaskDto } from './dto/run-task.dto';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = new Set([
  '.txt', '.md', '.csv', '.json', '.js', '.ts', '.jsx', '.tsx',
  '.py', '.java', '.c', '.cpp', '.h', '.rs', '.go', '.rb', '.php',
  '.html', '.css', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg',
  '.log', '.sql', '.sh', '.bat',
  '.pdf', '.png', '.jpg', '.jpeg', '.gif',
]);

function slugFilename(original: string): string {
  const ext = extname(original).toLowerCase();
  const base = original.slice(0, original.length - ext.length).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${base}-${randomUUID()?.slice(0, 8) || Date.now().toString(36)}${ext}`;
}

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

  @Post('upload-attachment')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads'),
        filename: (_req, file, cb) => {
          cb(null, slugFilename(file.originalname));
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) {
          return cb(
            new BadRequestException(`Unsupported file type: ${ext}`),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadAttachment(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');

    return {
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      path: file.path,
      size: file.size,
    };
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
