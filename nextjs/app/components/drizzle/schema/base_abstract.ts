import {
    serial,
    varchar,
} from 'drizzle-orm/pg-core'
import {
    C,
    NAME_LIMIT_2,
} from '@/app/components/Consts'

export const translate = () => ({
    id: serial(C.ID).primaryKey().unique().notNull(),
    name: varchar(C.NAME, { length: NAME_LIMIT_2 }).unique().notNull(),
    en: varchar('en', { length: NAME_LIMIT_2 }),
    ru: varchar('ru', { length: NAME_LIMIT_2 }),
})
