import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MatchingResult } from './matching-result.entity';
import { ProjectRequirement } from './project-requirement.entity';

@Entity('requirement_matches')
export class RequirementMatch {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  matching_result_id: number;

  @Column()
  requirement_id: number;

  @Column({
    type: 'enum',
    enum: ['direct', 'alternative', 'none'],
  })
  match_type: 'direct' | 'alternative' | 'none';

  @Column({ type: 'text', nullable: true })
  profile_evidence: string;

  @Column({ type: 'text', nullable: true })
  explanation: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  match_score: number;

  @ManyToOne(() => MatchingResult, (mr) => mr.requirement_matches, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'matching_result_id' })
  matching_result: MatchingResult;

  @ManyToOne(() => ProjectRequirement, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requirement_id' })
  requirement: ProjectRequirement;
}
