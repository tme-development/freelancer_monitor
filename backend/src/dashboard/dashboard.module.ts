import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Project,
  MatchingResult,
  RequirementMatch,
  Application,
  ApplicationOutcome,
  ConsultantProfile,
  Setting,
  ProjectRequirement,
} from '../database/entities';
import { DashboardController } from './dashboard.controller';
import { DashboardGateway } from './dashboard.gateway';
import { BackendActivityService } from './backend-activity.service';
import { MatchingModule } from '../matching/matching.module';
import { ApplicationModule } from '../application/application.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      ProjectRequirement,
      MatchingResult,
      RequirementMatch,
      Application,
      ApplicationOutcome,
      ConsultantProfile,
      Setting,
    ]),
    MatchingModule,
    ApplicationModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardGateway, BackendActivityService],
  exports: [DashboardGateway, BackendActivityService],
})
export class DashboardModule {}
