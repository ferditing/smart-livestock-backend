import { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

export async function seed(knex: Knex): Promise<void> {
  // clean up (best-effort)
  await knex('audit_logs').del().catch(()=>{});
  await knex('notifications').del().catch(()=>{});
  await knex('feedback_labels').del().catch(()=>{});
  await knex('model_versions').del().catch(()=>{});
  await knex('messages').del().catch(()=>{});
  await knex('threads').del().catch(()=>{});
  await knex('professional_applications').del().catch(()=>{});
  await knex('appointments').del().catch(()=>{});
  await knex('providers').del().catch(()=>{});
  await knex('prediction_logs').del().catch(()=>{});
  await knex('diagnoses').del().catch(()=>{});
  await knex('symptom_reports').del().catch(()=>{});
  await knex('animals').del().catch(()=>{});
  await knex('users').del().catch(()=>{});

  const saltRounds = +(process.env.BCRYPT_SALT_ROUNDS || 10);
  const farmerPwd = await bcrypt.hash('farmerpass', saltRounds);
  const vetPwd = await bcrypt.hash('vetpass', saltRounds);
  const vet2Pwd = await bcrypt.hash('vet2pass', saltRounds);
  const adminPwd = await bcrypt.hash('adminpass', saltRounds);
  const agrovetPwd = await bcrypt.hash('agrovetpass', saltRounds);

  // Admin user (email: admin@example.com, password: adminpass)
  await knex('users').insert({
    name: 'Admin',
    email: 'admin@gmail.com',
    phone: '+254700000000',
    password_hash: adminPwd,
    role: 'admin'
  });

  const userIds = await knex('users').insert({
    name: 'Test Farmer',
    email: 'farmer@example.com',
    phone: '+254700000001',
    password_hash: farmerPwd,
    role: 'farmer'
  }).returning('id');
  const farmerId = userIds[0].id;

  const vetIds = await knex('users').insert({
    name: 'Dr Vet A',
    email: 'veta@example.com',
    phone: '+254700000002',
    password_hash: vetPwd,
    role: 'vet'
  }).returning('id');
  const vetId = vetIds[0].id;

  const vet2Ids = await knex('users').insert({
    name: 'Dr Vet B',
    email: 'vetb@example.com',
    phone: '+254700000003',
    password_hash: vet2Pwd,
    role: 'vet'
  }).returning('id');
  const vet2Id = vet2Ids[0].id;

  const agroIds = await knex('users').insert({
    name: 'Agrovet Kenya',
    email: 'agrovet@example.com',
    phone: '+254700000004',
    password_hash: agrovetPwd,
    role: 'agrovet',
    county: 'Nairobi'
  }).returning('id');
  const agroId = agroIds[0].id;

  // animal for farmer
  await knex('animals').insert({
    user_id: farmerId,
    species: 'cow',
    breed: 'local',
    age: 4,
    weight: 350,
    tag_id: 'TAG-0001'
  });

  // providers with coordinates (lon,lat) - pre-verified for seed vets, pending for agrovet
  await knex.raw(`
    INSERT INTO providers (user_id,name,provider_type,location,services,availability,contact,verification_status,verified_at,verification_badge)
    VALUES
      (${vetId}, 'Vet A', 'vet', ST_SetSRID(ST_MakePoint(36.8219, -1.2921)::geometry,4326)::geography,
       '{"services":["diagnosis","vaccination"]}', '{}', '{"phone":"+254700000002"}', 'verified', NOW(), 'Verified Veterinarian'),
      (${vet2Id}, 'Vet B', 'vet', ST_SetSRID(ST_MakePoint(36.9, -1.3)::geometry,4326)::geography,
       '{"services":["surgery","consultation"]}', '{}', '{"phone":"+254700000003"}', 'verified', NOW(), 'Verified Veterinarian'),
      (${agroId}, 'Agrovet Kenya', 'agrovet', ST_SetSRID(ST_MakePoint(36.8172, -1.2864)::geometry,4326)::geography,
       '{"services":["medicines","feed","vaccines"]}', '{}', '{"phone":"+254700000004"}', 'pending', NULL, NULL)
  `);

  // insert dummy model_versions
  await knex('model_versions').insert({
    version_tag: 'dt-v1',
    artifact_path: '/models/decision_tree_model.pkl',
    trained_on_date: knex.raw('CURRENT_DATE'),
    metrics: JSON.stringify({ accuracy: 0.85 })
  });
}
