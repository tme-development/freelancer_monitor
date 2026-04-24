import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Project } from './project.entity';
import { ConsultantProfile } from './consultant-profile.entity';
import { RequirementMatch } from './requirement-match.entity';

@Entity('matching_results')
export class MatchingResult {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  project_id: number;

  @Column()
  profile_id: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  matching_rate: number;

  @Column({ length: 50, default: 'v1' })
  algorithm_version: string;

  @Column({ type: 'json', nullable: true })
  weight_config: any;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Project, (p) => p.matching_results, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => ConsultantProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile: ConsultantProfile;

  @OneToMany(() => RequirementMatch, (rm) => rm.matching_result)
  requirement_matches: RequirementMatch[];
}
