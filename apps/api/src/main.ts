import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { assertMfaDeferralConfiguration } from './auth/local-mfa';

config({ path: resolve(__dirname, '../../../.env') });

async function bootstrap(): Promise<void> {
  assertMfaDeferralConfiguration(process.env);
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();
