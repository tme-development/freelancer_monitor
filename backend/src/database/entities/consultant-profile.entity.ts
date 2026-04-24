import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ProfileSkill } from './profile-skill.entity';
import { ProfileExperience } from './profile-experience.entity';
import { ProfileCertification } from './profile-certification.entity';

@Entity('consultant_profiles')
export class ConsultantProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 255 })
  title: string;

  @Column({ length: 255, nullable: true })
  location: string;

  @Column({ length: 100, nullable: true })
  nationality: string;

  @Column({ type: 'int', nullable: true })
  birth_year: number;

  @Column({ type: 'text', nullable: true })
  summary: string;

  @Column({ type: 'json', nullable: true })
  languages: any;

  @Column({ type: 'json', nullable: true })
  industries: any;

  @Column({ type: 'json', nullable: true })
  domains: any;

  @Column({ type: 'json', nullable: true })
  service_offerings: any;

  @Column({ type: 'json', nullable: true })
  focus_areas: any;

  @Column({ type: 'longtext', nullable: true })
  raw_profile_text: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => ProfileSkill, (s) => s.profile)
  skills: ProfileSkill[];

  @OneToMany(() => ProfileExperience, (e) => e.profile)
  experiences: ProfileExperience[];

  @OneToMany(() => ProfileCertification, (c) => c.profile)
  certifications: ProfileCertification[];
}
