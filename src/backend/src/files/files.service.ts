import { BadRequestException, Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';

const UPLOAD_ROOT = join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 20 * 1024 * 1024;

@Injectable()
export class FilesService {
  constructor(private prisma: PrismaService) {}

  async createUpload(file: Express.Multer.File, uploaderId: string) {
    if (!file) throw new BadRequestException('File is required');
    if (file.size > MAX_FILE_SIZE) throw new BadRequestException('File is too large');

    const kind = this.detectKind(file.mimetype);
    const today = new Date().toISOString().slice(0, 10);
    const directory = join(UPLOAD_ROOT, today);
    await fs.mkdir(directory, { recursive: true });

    const extension = this.extensionFor(file.originalname);
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`;
    const storagePath = join(directory, fileName);
    await fs.writeFile(storagePath, file.buffer);

    const url = `/uploads/${today}/${fileName}`;
    return this.prisma.attachment.create({
      data: {
        uploaderId,
        kind,
        fileName: file.originalname,
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size,
        url,
        storagePath,
      },
    });
  }

  private detectKind(mimeType: string) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'file';
  }

  private extensionFor(fileName: string) {
    const match = fileName.match(/\.[a-zA-Z0-9]{1,12}$/);
    return match ? match[0].toLowerCase() : '';
  }
}
