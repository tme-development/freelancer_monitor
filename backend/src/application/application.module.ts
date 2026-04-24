import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Application,
  Project,
  MatchingResult,
  RequirementMatch,
  ConsultantProfile,
  Setting,
} from '../database/entities';
import { ApplicationService } from './application.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Application,
      Project,
      MatchingResult,
      RequirementMatch,
      ConsultantProfile,
      Setting,
    ]),
  ],
  providers: [ApplicationService],
  exports: [ApplicationService],
})
export class ApplicationModule {}
