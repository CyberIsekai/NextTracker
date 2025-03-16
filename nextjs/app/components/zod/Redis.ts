import { z } from 'zod'
import { C } from '@/app/components/Consts'
import {
    RouterDataType,
    RouterDataTypeSchema,
    RouterDate,
    RouterDateSchema,
    RouterOrderAll,
    RouterOrderAllSchema,
    RouterTargetSchema,
    RouterPage,
    RouterPageSchema,
    RouterTarget,
} from '@/app/components/zod/Router'
import {
    PlayerActiSchema,
    PlayerBattleSchema,
} from '@/app/components/zod/Player'
import {
    GroupUno,
    GroupUnoSchema,
    PlayerUno,
    PlayerUnoSchema,
} from '@/app/components/zod/Uno'
import { UserLogin, UserLoginSchema } from '@/app/components/zod/User'
import { GameMode, GameModeSchema } from '@/app/components/zod/GameMode'
import { LogsSourceCacheSchema } from '@/app/components/zod/Logs'
import { ZObject } from '@/app/components/zod/Utils'
import { TargetType, TargetTypeSchema } from '@/app/components/zod/Main'
import { is_number } from '@/app/components/UtilsValidators'

export const RedisActionSchema = z.enum([
    'get',
    'set',
    'rpush',
    'lpush', 'lrange', 'lindex', 'lpop', 'llen', 'lset', 'ltrim', 'lrem',
    'hset', 'hget', 'hdel', 'hmget', 'hkeys', 'hgetall',
    'delete',
    'keys',
    'flushall',
])
export type RedisAction = z.infer<typeof RedisActionSchema>

export const RedisValueSchema = z.string().or(z.number()).or(ZObject)
export type RedisValue = z.infer<typeof RedisValueSchema>

export const RedisTargetStatusSchema = z.enum([
    C.AUTO_UPDATE,
    'store_data',
])
export type RedisTargetStatus = z.infer<typeof RedisTargetStatusSchema>

export const CachePlayerUnoFindSchema = z.string()
    .startsWith(`${C.PLAYER}:`, { message: `Must start with ${C.PLAYER} prefix` })
    .regex(
        new RegExp(`^${C.PLAYER}:(${C.ID}|${C.ACTI}|${C.BATTLE})_[^:]+$`),
        `Must follow ${C.PLAYER}:<type>_<${C.TARGET}> format`
    )
    .transform(val => {
        const [prefix, rest] = val.split(':', 2)
        const [search_type, target] = rest.split('_', 2)
        return { prefix, search_type, target }
    })
    .pipe(
        z.object({
            prefix: z.literal(C.PLAYER),
            search_type: z.enum([C.ID, C.USERNAME, C.ACTI, C.BATTLE]),
            target: z.string()
        })
    )
    .refine(
        ({ search_type, target }) => {
            switch (search_type) {
                case C.ID:
                    return is_number(target)
                case C.USERNAME:
                    return true
                case C.ACTI:
                    return PlayerActiSchema.safeParse(target).success
                case C.BATTLE:
                    return PlayerBattleSchema.safeParse(target).success
                default:
                    return false
            }
        },
        ({ search_type }) => ({
            message: `Invalid ${C.TARGET} for ${search_type} search type`,
            path: [C.TARGET]
        })
    )
    .transform(({ prefix, search_type, target }) =>
        `${prefix}:${search_type}_${target}` as const
    )
export type CachePlayerUnoFind = z.infer<typeof CachePlayerUnoFindSchema>

export const CacheKeySchema = z.string()
    .refine(
        (val): val is `${RouterOrderAll}_${RouterDate}_${RouterPage}` => {
            const parts = val.split('_')
            if (parts.length < 3) return false

            const [order, ...rest] = parts
            const page = rest.pop()
            const date = rest.join('_')

            return RouterOrderAllSchema.safeParse(order).success &&
                RouterDateSchema.safeParse(date).success &&
                RouterPageSchema.safeParse(page).success
        },
        { message: `Must follow format: <RouterOrderAll>_<RouterDate>_<RouterTargetPage>` }
    )
export type CacheKey = z.infer<typeof CacheKeySchema>

export const CacheMatchesUidSchema = z.string()
    .refine(
        (val): val is `${C.MATCHES}:${RouterDataType}_${RouterTarget}_${GameMode}` => {
            const [matches, uid] = val.split(':')
            const parts = uid.split('_')
            if (matches !== C.MATCHES || parts.length < 3) {
                return false
            }

            const [router_data_type, target, game_mode] = parts

            return RouterDataTypeSchema.safeParse(router_data_type).success &&
                RouterTargetSchema.safeParse(target).success &&
                GameModeSchema.safeParse(game_mode).success
        },
        { message: `Must follow format: ${C.MATCHES}:<RouterDataType>_<RouterTarget>_<GameMode>` }
    )
export type CacheMatchesUid = z.infer<typeof CacheMatchesUidSchema>

export const CacheUserSchema = z.string()
    .refine(
        (val): val is CacheUser => {
            const [user, login] = val.split(':')
            return user === C.USER &&
                UserLoginSchema.safeParse(login).success
        },
        { message: `Must follow format: ${C.USER}:<UserLogin>` }
    )
export type CacheUser = `${C.USER}:${UserLogin}`

export const CachePlayerSchema = z.string()
    .refine(
        (val): val is `${C.PLAYER}:${C.UNO}_${PlayerUno}` => {
            const [target_type, uno] = val.split(':')
            return target_type === C.PLAYER &&
                PlayerUnoSchema.safeParse(uno).success
        },
        { message: `Must follow format: ${C.PLAYER}:${C.UNO}_<PlayerUno>` }
    )
export type CachePlayer = z.infer<typeof CachePlayerSchema>

export const CacheGroupSchema = z.string()
    .refine(
        (val): val is `${C.GROUP}:${C.UNO}_${GroupUno}` => {
            const [pattern, uno] = val.split('_')
            return pattern === `${C.GROUP}:${C.UNO}` &&
                GroupUnoSchema.safeParse(uno).success
        },
        { message: `Must follow format: ${C.GROUP}:${C.UNO}_<GroupUno>` }
    )
export type CacheGroup = z.infer<typeof CacheGroupSchema>

export const RedisTargetGetSchema = z.union([
    RedisTargetStatusSchema,
    CachePlayerUnoFindSchema,
    z.enum([C.STATUS, C.TRANSLATE, 'test'])
])
export type RedisTargetGet = z.infer<typeof RedisTargetGetSchema>

export const RedisTargetListSchema = z.enum([
    ...LogsSourceCacheSchema.options,
    C.TASK_QUEUES,
    C.UPDATE_PLAYERS,
])
export type RedisTargetList = z.infer<typeof RedisTargetListSchema>

export const RedisTargetHashSchema = z.string()
    .refine(
        (val): val is CacheUser | CachePlayer | CacheGroup | CacheMatchesUid => {
            return CacheMatchesUidSchema.safeParse(val).success ||
                CacheUserSchema.safeParse(val).success ||
                CachePlayerSchema.safeParse(val).success ||
                CacheGroupSchema.safeParse(val).success
        },
        val => ({ message: `[${val}] ${C.NOT_VALID} RedisTargetHash` }),
    )
export type RedisTargetHash = z.infer<typeof RedisTargetHashSchema>

export const RedisTargetDeletePatternSchema = z.string()
    .refine(
        (val): val is `${TargetType}:*` => {
            const [target_type, asterisk] = val.split(':')

            return TargetTypeSchema.safeParse(target_type).success &&
                asterisk === '*'
        },
        { message: 'Must follow format: <TargetType>:*' },
    )
export type RedisTargetDeletePattern = z.infer<typeof RedisTargetDeletePatternSchema>

export const RedisTargetKeysSchema = z.string()
    .refine(
        (val): val is `${TargetType}:${C.UNO}_*` => {
            const [target_type, rest] = val.split(':')
            return TargetTypeSchema.safeParse(target_type).success &&
                rest === `${C.UNO}_*`
        },
        { message: `Must follow format: <TargetType>:${C.UNO}_*` }
    )
export type RedisTargetKeys = z.infer<typeof RedisTargetKeysSchema>

export const RedisTargethSchema = z.string()
    .refine(
        (val): val is (
            | RedisTargetHash
            | RedisTargetGet
            | RedisTargetList
            | RedisTargetDeletePattern
            | RedisTargetKeys
        ) => (
            RedisTargetGetSchema.safeParse(val).success ||
            RedisTargetListSchema.safeParse(val).success ||
            RedisTargetHashSchema.safeParse(val).success ||
            RedisTargetDeletePatternSchema.safeParse(val).success ||
            RedisTargetKeysSchema.safeParse(val).success
        ),
        val => ({ message: `[${val}] ${C.NOT_VALID} RedisTarget` }),
    )
export type RedisTarget = z.infer<typeof RedisTargethSchema>

export const RedisValueLsetSchema = z.object({
    index: z.number(),
    value: RedisValueSchema,
})
export type RedisValueLset = z.infer<typeof RedisValueLsetSchema>
