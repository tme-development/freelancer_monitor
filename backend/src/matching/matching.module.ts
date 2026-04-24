import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Project,
  ProjectRequirement,
  MatchingResult,
  RequirementMatch,
  ConsultantProfile,
  Setting,
} from '../database/entities';
import { MatchingService } from './matching.service';
import { MatchingCalculator } from './matching-calculator';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      ProjectRequirement,
      MatchingResult,
      RequirementMatch,
      ConsultantProfile,
      Setting,
    ]),
  ],
  providers: [MatchingService, MatchingCalculator],
  exports: [MatchingService],
})
export class MatchingModule {}
