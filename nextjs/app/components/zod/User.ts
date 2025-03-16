import { z } from 'zod'
import { C } from '@/app/components/Consts'
import { LanguageSchema } from '@/app/components/zod/Language'

export const UserLoginSchema = z.string()
    .min(+process.env.LOGIN_LENGTH_REQUIRED!)
    .max(+process.env.LOGIN_LENGTH_LIMIT!)
    .regex(/[^0-9]/)
    .refine(val => !val.includes(' '), { message: 'must not contain spaces' })
    .readonly()
export type UserLogin = z.infer<typeof UserLoginSchema>

export const UserPasswordSchema = z.string()
    .min(+process.env.PASSWORD_LENGTH_REQUIRED!)
    .max(+process.env.PASSWORD_LENGTH_LIMIT!)
export type UserPassword = z.infer<typeof UserPasswordSchema>

export const UsersPageSchema = z.object({
    name: z.string(),
    path: z.string(),
    sub_pages: z.array(z.string()),
})
export type UsersPage = z.infer<typeof UsersPageSchema>

export const UserBasicSchema = z.object({
    login: UserLoginSchema,
    email: z.string().email().nullable(),
    username: z.string().nullable(),
    language: LanguageSchema,
    pages: z.array(UsersPageSchema),
    roles: z.array(z.string()),
    time: z.string().datetime(),
})

export const UserStatusSchema = z.nativeEnum({
    NOT_ENABLED: 0,
    ENABLED: 1,
} as const)
export type UserStatus = z.infer<typeof UserStatusSchema>

export const UserSchema = UserBasicSchema.merge(z.object({
    id: z.number(),
    password: UserPasswordSchema,
    data: z.record(z.string(), z.string()),
    status: UserStatusSchema,
    token: z.string(),
}))
export type User = z.infer<typeof UserSchema>

export const UserProfileSchema = UserBasicSchema.merge(z.object({
    token: z.string().readonly(),
}))
export type UserProfile = z.infer<typeof UserProfileSchema>

export const UsersResponseSchema = z.object({
    users: z.array(UserProfileSchema),
    roles: z.array(z.string()),
})
export type UsersResponse = z.infer<typeof UsersResponseSchema>

export const UserAuthorizeSchema = z.object({
    login: UserLoginSchema,
    password: UserPasswordSchema,
})
export type UserAuthorize = z.infer<typeof UserAuthorizeSchema>

export const UserRegisterSchema = z.object({
    login: UserLoginSchema,
    email: z.string().email().nullable(),
    username: z.string().nullable(),
    language: LanguageSchema,
    password: UserPasswordSchema,
    data: z.record(z.string(), z.string()),
})
export type UserRegister = z.infer<typeof UserRegisterSchema>

export const PROFILE = UserProfileSchema.parse({
    login: C.GUEST,
    email: null,
    username: C.GUEST,
    token: C.GUEST,
    pages: [{ name: C.MAIN, path: '/', sub_pages: [] }],
    language: LanguageSchema.options[0],
    roles: [],
    time: new Date().toISOString(),
})

export const UsersRoleAccessSchema = z.object({
    level: z.number(),
    pages: z.array(UsersPageSchema),
    access: z.array(z.string()),
})
export type UsersRoleAccess = z.infer<typeof UsersRoleAccessSchema>

export const UsersRoleSchema = UsersRoleAccessSchema.merge(z.object({
    id: z.number(),
    name: z.string(),
}))
export type UsersRole = z.infer<typeof UsersRoleSchema>

export const UsersRoleResponseSchema = z.object({
    roles: z.array(UsersRoleSchema),
})
export type UsersRoleResponse = z.infer<typeof UsersRoleResponseSchema>
