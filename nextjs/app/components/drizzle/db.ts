import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '@/app/components/drizzle/schema'

export const connection = postgres(process.env.DATABASE_URL!)
export const db = drizzle(connection, { schema })
