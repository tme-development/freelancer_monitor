import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { ProjectRequirement } from './project-requirement.entity';
import { MatchingResult } from './matching-result.entity';
import { Application } from './application.entity';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', unique: true })
  external_id: number;

  @Column({ length: 500 })
  title: string;

  @Column({ length: 500, nullable: true })
  slug: string;

  @Column({ length: 255, nullable: true })
  company: string;

  @Column({ type: 'longtext', nullable: true })
  description_html: string;

  @Column({ type: 'longtext', nullable: true })
  description_text: string;

  @Column({ length: 255, nullable: true })
  city: string;

  @Column({ length: 100, nullable: true })
  country: string;

  @Column({ type: 'int', nullable: true })
  remote_percent: number;

  @Column({ length: 50, nullable: true })
  contract_type: string;

  @Column({ type: 'int', nullable: true })
  duration_months: number;

  @Column({ type: 'boolean', default: false })
  extension_possible: boolean;

  @Column({ type: 'int', nullable: true })
  workload: number;

  @Column({ length: 100, nullable: true })
  start_text: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  budget: number;

  @Column({ length: 255, nullable: true })
  industry: string;

  @Column({ type: 'json', nullable: true })
  skills_json: any;

  @Column({ length: 500 })
  project_url: string;

  @Column({ type: 'boolean', nullable: true })
  is_endcustomer: boolean;

  @Column({ length: 50, nullable: true })
  application_channel: string;

  @Column({ type: 'text', nullable: true })
  application_instructions: string;

  @Column({ length: 10, nullable: true })
  detected_language: string;

  @Column({ type: 'longtext', nullable: true })
  raw_json: string;

  @Column({ type: 'text', nullable: true })
  summary: string;

  /** Listing created / publication time from Freelancermap ProjectShow JSON (canonical “published” date). */
  @Column({ type: 'datetime', nullable: true })
  external_created: Date | null;

  @Column({ type: 'datetime', nullable: true })
  scraped_at: Date | null;

  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;

  @Column({ type: 'datetime', nullable: true })
  deleted_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => ProjectRequirement, (r) => r.project)
  requirements: ProjectRequirement[];

  @OneToMany(() => MatchingResult, (m) => m.project)
  matching_results: MatchingResult[];

  @OneToOne(() => Application, (a) => a.project)
  application: Application;
}
