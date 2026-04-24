import { DataSource } from 'typeorm';
import * as entities from './entities';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  username: process.env.MYSQL_USER || 'project_manager',
  password: process.env.MYSQL_PASSWORD || 'changeme_in_production',
  database: process.env.MYSQL_DATABASE || 'project_manager',
  entities: Object.values(entities),
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
