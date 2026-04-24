import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Project } from './project.entity';
import { MatchingResult } from './matching-result.entity';
import { ApplicationOutcome } from './application-outcome.entity';

@Entity('applications')
export class Application {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  project_id: number;

  @Column()
  matching_result_id: number;

  @Column({ type: 'text', nullable: true })
  motivation_paragraph: string;

  @Column({ type: 'longtext', nullable: true })
  application_body: string;

  @Column({ type: 'longtext', nullable: true })
  full_application_text: string;

  @Column({ length: 50, nullable: true })
  application_channel: string;

  @Column({ type: 'text', nullable: true })
  application_instructions: string;

  @Column({ length: 10, nullable: true })
  detected_language: string;

  @CreateDateColumn()
  created_at: Date;

  @OneToOne(() => Project, (p) => p.application, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => MatchingResult, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'matching_result_id' })
  matching_result: MatchingResult;

  @OneToMany(() => ApplicationOutcome, (o) => o.application)
  outcomes: ApplicationOutcome[];
}
