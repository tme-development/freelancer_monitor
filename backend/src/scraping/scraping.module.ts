import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../database/entities';
import { ScrapingService } from './scraping.service';
import { ProjectParserService } from './project-parser.service';

@Module({
  imports: [TypeOrmModule.forFeature([Project])],
  providers: [ScrapingService, ProjectParserService],
  exports: [ScrapingService],
})
export class ScrapingModule {}
