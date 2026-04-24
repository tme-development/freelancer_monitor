import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ConsultantProfile } from './consultant-profile.entity';

@Entity('profile_skills')
export class ProfileSkill {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  profile_id: number;

  @Column({ length: 50 })
  category: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'int', default: 0 })
  proficiency_level: number;

  @Column({ type: 'int', nullable: true })
  years_experience: number;

  @ManyToOne(() => ConsultantProfile, (p) => p.skills, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile: ConsultantProfile;
}
