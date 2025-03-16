'use server'

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'

export default async function db_migrate() {
  const migrationClient = postgres(process.env.DATABASE_URL!, { max: 1 })
  const db = drizzle(migrationClient)
  await migrate(db, { migrationsFolder: './app/components/drizzle/migrations' })
}