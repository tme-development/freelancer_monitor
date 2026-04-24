import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from './project.entity';

@Entity('project_requirements')
export class ProjectRequirement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  project_id: number;

  @Column({ type: 'text' })
  requirement_text: string;

  @Column({ length: 100, nullable: true })
  category: string;

  @Column({ type: 'boolean', default: true })
  is_must_have: boolean;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @ManyToOne(() => Project, (p) => p.requirements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;
}
