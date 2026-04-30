import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class DropLegacyApplicationColumns1777553700000
  implements MigrationInterface
{
  name = 'DropLegacyApplicationColumns1777553700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasMotivation = await queryRunner.hasColumn(
      'applications',
      'motivation_paragraph',
    );
    if (hasMotivation) {
      await queryRunner.dropColumn('applications', 'motivation_paragraph');
    }

    const hasBody = await queryRunner.hasColumn(
      'applications',
      'application_body',
    );
    if (hasBody) {
      await queryRunner.dropColumn('applications', 'application_body');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasMotivation = await queryRunner.hasColumn(
      'applications',
      'motivation_paragraph',
    );
    if (!hasMotivation) {
      await queryRunner.addColumn(
        'applications',
        new TableColumn({
          name: 'motivation_paragraph',
          type: 'text',
          isNullable: true,
        }),
      );
    }

    const hasBody = await queryRunner.hasColumn('applications', 'application_body');
    if (!hasBody) {
      await queryRunner.addColumn(
        'applications',
        new TableColumn({
          name: 'application_body',
          type: 'longtext',
          isNullable: true,
        }),
      );
    }
  }
}
