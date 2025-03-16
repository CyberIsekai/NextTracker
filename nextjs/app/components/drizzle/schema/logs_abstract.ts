import {
    serial,
    text,
    varchar,
    timestamp,
    jsonb,
} from 'drizzle-orm/pg-core'
import {
    C,
    NAME_LIMIT_2,
} from '@/app/components/Consts'


export const logs = () => ({
    id: serial(C.ID).primaryKey().unique().notNull(),
    target: varchar(C.TARGET, { length: NAME_LIMIT_2 }).notNull(),
    message: text(C.MESSAGE),
    data: jsonb(C.DATA).$type<object | null>().default(null),
    time: timestamp(C.TIME).defaultNow().notNull(),
})

export const logs_request = () => ({
    id: serial(C.ID).primaryKey().unique().notNull(),
    client: varchar('client', { length: NAME_LIMIT_2 }).notNull(),
    path: varchar('path', { length: 400 }).notNull(),
    user_agent: varchar('user_agent', { length: 400 }).notNull(),
    data: jsonb(C.DATA).$type<Record<string, string>>().default({}),
    time: timestamp(C.TIME).defaultNow().notNull(),
})
