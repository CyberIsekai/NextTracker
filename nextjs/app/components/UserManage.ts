'use server'

import * as bcrypt from 'bcryptjs'
import * as jwt from 'jsonwebtoken'
import { eq, max, sql } from 'drizzle-orm'
import type { StringValue } from 'ms'
import * as schema from '@/app/components/drizzle/schema'
import redis_manage from '@/app/components/Redis'
import { db } from '@/app/components/drizzle/db'
import { in_logs, } from '@/app/components/UtilsBase'
import { C } from '@/app/components/Consts'
import {
    UsersPage,
    User,
    UserProfile,
    UserRegister,
} from '@/app/components/zod/User'
import {
    Language,
    LanguageSchema,
} from '@/app/components/zod/Language'

export const user_authorize = async (login: string, password: string) => {
    const user = await redis_manage(`${C.USER}:${login}`, 'hgetall')

    // check if user exist and compare hashed passwords
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return `${C.LOGIN} or ${C.PASSWORD} incorrect`
    }

    const user_profile = await user_profile_format(user)

    return user_profile
}

export const user_register = async (user: UserRegister): Promise<string | UserProfile> => {
    const { login } = user

    const forbiden_logins: string[] = [C.ADMIN, C.USER, C.GUEST]
    if (forbiden_logins.includes(login.toLocaleLowerCase())) {
        return `${C.LOGIN} [${login}] forbiden`
    }

    const users_rows = (
        await db.select({ count: sql<number>`count(*)::int` })
            .from(schema.users)
            .where(eq(schema.users.login, login))
    )[0].count

    if (users_rows) {
        return `${C.USER} [${login}] ${C.ALREADY_EXIST}`
    }

    const [max_id] = await db.select({ value: max(schema.users.id) }).from(schema.users)
    const [user_added] = await db.insert(schema.users).values({
        ...user,
        id: max_id.value ? (max_id.value + 1) : undefined,
        password: await hash_password(user.password),
        data: user.data
    }).returning()
    const user_cache = await user_cache_set(user_added)
    const user_profile = await user_profile_format(user_cache)

    return user_profile
}

export const user_update = async (
    login: string,
    db_version: object,
    cache_version = db_version
) => {
    await db.update(schema.users).set(db_version).where(eq(schema.users.login, login))
    await redis_manage(`${C.USER}:${login}`, 'hset', cache_version)
}

export const user_edit_language = async (login: string, language: Language) => {
    await user_update(login, { language: LanguageSchema.parse(language) })
}

export const user_edit_roles = async (login: string, roles_given: string[]) => {
    const roles = await db.query.users_role.findMany({ columns: { name: true, level: true } })
    const roles_names = roles.map(role => role.name)
    const not_valid_roles = roles_given.filter(role => !roles_names.includes(role))

    if (not_valid_roles.length) {
        throw new Error(`${C.ROLES} [${not_valid_roles}] ${C.NOT_VALID}`)
    }

    const roles_sorted_by_level = roles
        .filter(role => roles_given.includes(role.name))
        .sort((a, b) => b.level - a.level)
        .map(role => role.name)

    await user_update(login, { roles: roles_sorted_by_level })
}

export const user_edit_time = async (login: string, time: Date) => {
    await user_update(login, { time }, { time: time.toISOString() })
}

export const user_edit_username = async (login: string, username: string | null) => {
    if (username !== null && username.length < 4) {
        throw new Error(`${C.USERNAME} too short`)
    }
    if (username !== null && username.length > 30) {
        throw new Error(`${C.USERNAME} too long`)
    }
    await user_update(login, { username })
}

export const user_edit_email = async (login: string, email: string | null) => {
    if (email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error(`${C.EMAIL} ${C.NOT_VALID}`)
    }
    await user_update(login, { email })
}

export const user_delete = async (login: string) => {
    const query = eq(schema.users.login, login)
    const user = await db.query.users.findFirst({ where: query })
    if (!user) {
        throw new Error(`${C.USER} ${C.LOGIN} [${login}] ${C.NOT_FOUND}`)
    }
    await db.delete(schema.users).where(query)
    redis_manage(`${C.USER}:${login}`, C.DELETE)
    in_logs(login, C.DELETED, 'logs_user', user)
}

export const token_encode = async (
    payload: Record<string, string>,
    expire: StringValue
) => jwt.sign(
    payload,
    process.env.ADMIN_PASSWORD!,
    { expiresIn: expire }
)

export const token_decode = async (token: string, key: C.LOGIN): Promise<string> => {
    try {
        const payload = jwt.verify(token, process.env.ADMIN_PASSWORD!)
        if (typeof payload === 'string') {
            return payload
        }
        return payload[key]
    } catch {
        if (key === C.LOGIN) {
            return C.GUEST
        }
        return ''
    }
}

export const hash_password = async (password: string) => {
    const salt = bcrypt.genSaltSync(12)
    const hashed_password = bcrypt.hashSync(password, salt)
    return hashed_password
}

export const user_cache_set = async (
    user: typeof schema.users.$inferSelect,
    roles?: typeof schema.users_role.$inferSelect[],
) => {
    roles = roles || await db.query.users_role.findMany()
    const role_pages: Record<string, UsersPage[]> = {}
    for (const role of roles) {
        role_pages[role.name] = role.pages
    }

    // check user roles and fix if found not valid
    const role_names = roles.map(role => role.name)
    const roles_valid = user.roles.filter(role => role_names.includes(role))
    const roles_not_valid = user.roles.filter(role => !role_names.includes(role))

    if (roles_not_valid.length) {
        user.roles = roles_valid // set only valid roles
        db.update(schema.users)
            .set({ roles: user.roles })
            .where(eq(schema.users.login, user.login))
        in_logs(
            user.login,
            `${C.ROLES} ${C.DELETED} ${roles_not_valid}`,
            'logs_user',
        )
    }

    const user_cache: User = {
        ...user,
        pages: user.roles.map(role_name => role_pages[role_name]).flat(1),
        token: '',
        time: user.time.toISOString()
    }
    await redis_manage(`${C.USER}:${user.login}`, 'hset', user_cache)

    return user_cache
}

export const users_cache_set = async () => {
    const roles = await db.query.users_role.findMany()
    const users = await db.query.users.findMany()
    for (const user of users) {
        user_cache_set(user, roles)
    }
}

const user_profile_format = async (user: User): Promise<UserProfile> => ({
    login: user.login,
    email: user.email,
    username: user.username,
    token: await token_encode({ login: user.login }, `${+process.env.TOKEN_EXPIRE_DAYS!} days`),
    pages: user.pages,
    language: user.language,
    roles: user.roles,
    time: user.time
})
