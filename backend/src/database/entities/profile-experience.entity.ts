import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ConsultantProfile } from './consultant-profile.entity';

@Entity('profile_experiences')
export class ProfileExperience {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  profile_id: number;

  @Column({ length: 500 })
  project_title: string;

  @Column({ length: 255 })
  company: string;

  @Column({ length: 255 })
  role: string;

  @Column({ type: 'date', nullable: true })
  start_date: string;

  @Column({ type: 'date', nullable: true })
  end_date: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  technologies: any;

  @Column({ type: 'json', nullable: true })
  domains: any;
  
  @ManyToOne(() => ConsultantProfile, (p) => p.experiences, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'profile_id' })
  profile: ConsultantProfile;
}
