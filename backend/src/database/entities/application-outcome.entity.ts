import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Application } from './application.entity';

@Entity('application_outcomes')
export class ApplicationOutcome {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  application_id: number;

  @Column({
    type: 'enum',
    enum: [
      'draft',
      'sent',
      'shortlisted',
      'rejected',
      'interview',
      'offer',
      'won',
      'lost',
      'withdrawn',
    ],
    default: 'draft',
  })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'datetime', nullable: true })
  status_changed_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Application, (a) => a.outcomes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application: Application;
}
