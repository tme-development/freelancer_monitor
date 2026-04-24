import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project, Setting } from '../database/entities';
import { ScrapingModule } from '../scraping/scraping.module';
import { MatchingModule } from '../matching/matching.module';
import { ApplicationModule } from '../application/application.module';
import { SchedulerService } from './scheduler.service';
import { DashboardModule } from '../dashboard/dashboard.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Setting]),
    ScrapingModule,
    MatchingModule,
    ApplicationModule,
    DashboardModule,
  ],
  providers: [SchedulerService],
})
export class SchedulerModule {}
