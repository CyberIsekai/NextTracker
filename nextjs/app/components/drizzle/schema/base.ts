import {
    pgTable,
    serial,
    smallint,
    text,
    varchar,
    timestamp,
    jsonb,
    json,
} from 'drizzle-orm/pg-core'
import {
    C,
    NAME_LIMIT,
    NAME_LIMIT_2,
} from '@/app/components/Consts'
import * as logs_abstract from './logs_abstract'
import { index_builder } from './utils'
import {
    User,
    UsersRoleAccess,
} from '@/app/components/zod/User'
import { Language } from '@/app/components/zod/Language'
import { Config } from '@/app/components/zod/Config'

export const users = pgTable(C.USERS, {
    id: serial(C.ID).primaryKey().unique().notNull(),
    status: smallint(C.STATUS).$type<User['status']>().default(0).notNull(),
    login: varchar(C.LOGIN, { length: NAME_LIMIT_2 }).$type<User['login']>().unique().notNull(),
    password: text(C.PASSWORD).$type<User['password']>().notNull(),
    email: varchar(C.EMAIL, { length: NAME_LIMIT_2 }).$type<User['email']>(),
    username: varchar(C.USERNAME, { length: NAME_LIMIT_2 }).$type<User['username']>(),
    data: jsonb(C.DATA).$type<User['data']>().default({}).notNull(),
    language: varchar(C.LANGUAGE, { length: 5 }).$type<Language>().default(C.EN).notNull(),
    roles: json(C.ROLES).$type<User['roles']>().default([C.USER]).notNull(),
    time: timestamp(C.TIME).defaultNow().notNull(),
}, table => index_builder([table.id, table.email], [table.login]))

export const users_role = pgTable('users_role', {
    id: serial(C.ID).primaryKey().unique().notNull(),
    name: varchar(C.NAME, { length: NAME_LIMIT }).unique().notNull(),
    level: smallint(C.LEVEL).default(0).notNull(),
    access: json('access').$type<UsersRoleAccess['access']>().default([]).notNull(),
    pages: jsonb(C.PAGES).$type<UsersRoleAccess[C.PAGES]>().default([]).notNull()
}, table => index_builder([table.id]))

// export const UsersRolesRelations = relations(users_role, ({ one }) => ({
//     role: one(users, {
//         fields: [users_role.name],
//         references: [users.roles],
//     }),
// }))

export const configs = pgTable(C.CONFIGS, {
    id: serial(C.ID).primaryKey().unique().notNull(),
    name: varchar(C.NAME, { length: NAME_LIMIT }).$type<Config['name']>().notNull(),
    source: varchar(C.SOURCE, { length: NAME_LIMIT }).$type<Config['source']>().notNull(),
    data: jsonb(C.DATA).$type<Config['data']>().default({}).notNull(),
    time: timestamp(C.TIME).defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => index_builder([table.id]))

export const logs = pgTable(
    C.LOGS,
    logs_abstract.logs(),
    table => index_builder([table.id, table.time])
)

export const logs_user = pgTable(
    'logs_user',
    logs_abstract.logs(),
    table => index_builder([table.id, table.time])
)

export const logs_error = pgTable(
    'logs_error',
    logs_abstract.logs(),
    table => index_builder([table.id, table.time])
)

export const logs_url = pgTable(
    'logs_url',
    logs_abstract.logs(),
    table => index_builder([table.id, table.time])
)

export const logs_ip = pgTable(
    'logs_ip',
    logs_abstract.logs(),
    table => index_builder([table.id, table.time])
)

export const logs_request = pgTable(
    'logs_request',
    logs_abstract.logs_request(),
    table => index_builder([table.id, table.time, table.path])
)
export const logs_request_error = pgTable(
    'logs_request_error',
    logs_abstract.logs_request(),
    table => index_builder([table.id, table.time, table.path])
)
export const logs_request_auth = pgTable(
    'logs_request_auth',
    {
        ...logs_abstract.logs_request(),
        message: varchar(C.MESSAGE, { length: 400 }),
    },
    table => index_builder([table.id, table.time, table.path, table.message])
)
