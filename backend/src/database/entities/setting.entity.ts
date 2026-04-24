import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('settings')
export class Setting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, unique: true })
  key_name: string;

  @Column({ type: 'text', nullable: true })
  value_text: string;

  @Column({ length: 20, default: 'string' })
  value_type: string;

  @UpdateDateColumn()
  updated_at: Date;
}
