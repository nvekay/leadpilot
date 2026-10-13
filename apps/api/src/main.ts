import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { env } from './config/env.js';

const app = await NestFactory.create(AppModule, { rawBody: true });
app.enableShutdownHooks();
await app.listen(env().PORT);
