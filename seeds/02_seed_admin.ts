import { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

export async function seed(knex: Knex): Promise<void> {
  // Optional: delete existing admin with same email
  await knex('users')
    .where({ email: 'admin@gmail.com' })
    .del()
    .catch(() => {});

  const saltRounds = +(process.env.BCRYPT_SALT_ROUNDS || 10);
  const adminPwd = await bcrypt.hash('adminpass', saltRounds);

  await knex('users').insert({
    name: 'System Admin',
    email: 'admin@gmail.com',
    phone: '+254700000000',
    password_hash: adminPwd,
    role: 'admin'
  });

  console.log('✅ Admin seed inserted successfully');
}