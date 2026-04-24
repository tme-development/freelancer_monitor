import { AppDataSource } from '../data-source';
import { ConsultantProfile } from '../entities/consultant-profile.entity';
import { ProfileSkill } from '../entities/profile-skill.entity';
import { ProfileExperience } from '../entities/profile-experience.entity';
import { ProfileCertification } from '../entities/profile-certification.entity';
import { Setting } from '../entities/setting.entity';
import * as fs from 'fs';
import * as path from 'path';

async function seed() {
  await AppDataSource.initialize();
  console.log('Database connected. Running seed…');

  const profilePath = path.resolve(
    __dirname,
    '../../../../data/profile/consultant-profile.json',
  );
  const raw = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));

  const profileRepo = AppDataSource.getRepository(ConsultantProfile);
  const existing = await profileRepo.findOneBy({ name: raw.name });
  if (existing) {
    console.log('Profile already exists, skipping seed.');
    await AppDataSource.destroy();
    return;
  }

  const profile = profileRepo.create({
    name: raw.name,
    title: raw.title,
    location: raw.location,
    nationality: raw.nationality,
    birth_year: raw.birth_year,
    summary: raw.summary,
    languages: raw.languages,
    industries: raw.industries,
    domains: raw.domains,
    service_offerings: raw.service_offerings,
    focus_areas: raw.focus_areas,
    raw_profile_text: JSON.stringify(raw, null, 2),
  });
  const saved = await profileRepo.save(profile);

  const skillRepo = AppDataSource.getRepository(ProfileSkill);
  for (const s of raw.skills) {
    await skillRepo.save(
      skillRepo.create({
        profile_id: saved.id,
        category: s.category,
        name: s.name,
        proficiency_level: s.proficiency_level || 0,
        years_experience: s.years_experience || null,
      }),
    );
  }

  const expRepo = AppDataSource.getRepository(ProfileExperience);
  for (const e of raw.experiences) {
    await expRepo.save(
      expRepo.create({
        profile_id: saved.id,
        project_title: e.project_title,
        company: e.company,
        role: e.role,
        start_date: e.start_date,
        end_date: e.end_date,
        description: e.description,
        technologies: e.technologies,
        domains: e.domains,
      }),
    );
  }

  const certRepo = AppDataSource.getRepository(ProfileCertification);
  for (const c of raw.certifications) {
    await certRepo.save(
      certRepo.create({
        profile_id: saved.id,
        name: c.name,
        issuer: c.issuer,
        year: c.year,
      }),
    );
  }

  const settingRepo = AppDataSource.getRepository(Setting);
  const defaults: Array<{ key_name: string; value_text: string; value_type: string }> = [
    { key_name: 'polling_interval_minutes', value_text: '30', value_type: 'number' },
    { key_name: 'matching_threshold_application', value_text: '40', value_type: 'number' },
    { key_name: 'matching_threshold_very_high', value_text: '85', value_type: 'number' },
    { key_name: 'weight_direct', value_text: '1.0', value_type: 'number' },
    { key_name: 'weight_alternative', value_text: '0.5', value_type: 'number' },
    { key_name: 'weight_must_have', value_text: '2.0', value_type: 'number' },
    { key_name: 'weight_nice_to_have', value_text: '1.0', value_type: 'number' },
    { key_name: 'alert_audio_file', value_text: '/data/audio/alert.mp3', value_type: 'string' },
    { key_name: 'freelancermap_search_url', value_text: 'https://www.freelancermap.de/projekte?categories%5B0%5D=1&created=1&projectContractTypes%5B0%5D=contracting&remoteInPercent%5B0%5D=100&sort=1&pagenr=1', value_type: 'string' },
    { key_name: 'scraping_paused', value_text: '0', value_type: 'boolean' },
  ];
  for (const d of defaults) {
    const exists = await settingRepo.findOneBy({ key_name: d.key_name });
    if (!exists) {
      await settingRepo.save(settingRepo.create(d));
    }
  }

  console.log('Seed completed successfully.');
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
