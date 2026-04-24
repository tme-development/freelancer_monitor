import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import * as entities from './database/entities';
import { McpModule } from './mcp/mcp.module';
import { ScrapingModule } from './scraping/scraping.module';
import { MatchingModule } from './matching/matching.module';
import { ApplicationModule } from './application/application.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
      username: process.env.MYSQL_USER || 'project_manager',
      password: process.env.MYSQL_PASSWORD || 'changeme_in_production',
      database: process.env.MYSQL_DATABASE || 'project_manager',
      entities: Object.values(entities),
      synchronize: true,
      logging: process.env.NODE_ENV === 'development',
    }),
    ScheduleModule.forRoot(),
    McpModule,
    ScrapingModule,
    MatchingModule,
    ApplicationModule,
    SchedulerModule,
    DashboardModule,
  ],
})
export class AppModule {}
