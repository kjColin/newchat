import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import express from 'express';
import { join } from 'path';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().set('trust proxy', 2);
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));
  app.setGlobalPrefix('api');

  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:4173',
      'http://localhost:3001',
      'https://newchat.clnkj.de',
    ],
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  app.useGlobalFilters(new GlobalExceptionFilter());

  // P1: Rate limiting 简单实现
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  const RATE_LIMIT = 120; // 120 requests per minute
  const WINDOW_MS = 60000;
  const getClientIp = (req: any) => {
    const cfIp = req.headers['cf-connecting-ip'];
    if (typeof cfIp === 'string' && cfIp) return cfIp;

    const forwardedFor = req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }

    return req.ip || req.socket.remoteAddress || 'unknown';
  };

  app.use((req, res, next) => {
    const ip = getClientIp(req);
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record || now > record.resetTime) {
      rateLimitMap.set(ip, { count: 1, resetTime: now + WINDOW_MS });
      return next();
    }

    if (record.count >= RATE_LIMIT) {
      return res.status(429).json({
        success: false,
        statusCode: 429,
        message: 'Too many requests',
        timestamp: new Date().toISOString(),
      });
    }

    record.count++;
    next();
  });

  const port = process.env.PORT || 3000;
  const host = process.env.HOST || '127.0.0.1';
  await app.listen(port, host);
  console.log(`Server running on http://${host}:${port}`);
}
bootstrap();
