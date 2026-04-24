import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ConsultantProfile } from './consultant-profile.entity';

@Entity('profile_certifications')
export class ProfileCertification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  profile_id: number;

  @Column({ length: 500 })
  name: string;

  @Column({ length: 255 })
  issuer: string;

  @Column({ type: 'int', nullable: true })
  year: number;

  @ManyToOne(() => ConsultantProfile, (p) => p.certifications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'profile_id' })
  profile: ConsultantProfile;
}
