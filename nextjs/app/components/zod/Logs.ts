import { z } from 'zod'
import { C } from '@/app/components/Consts'
import {
    PlayerActiSchema,
    PlayerBattleSchema,
    PlayerSchema,
} from '@/app/components/zod/Player'
import { UserLoginSchema } from '@/app/components/zod/User'
import { TaskSchema } from '@/app/components/zod/Task'
import { PlayerUnoSchema } from '@/app/components/zod/Uno'
import { GameModeSchema } from '@/app/components/zod/GameMode'

export const LogsBasicSchema = z.enum([
    C.LOGS,
    'logs_user',
    'logs_error',
    'logs_url',
    'cod_logs',
    'cod_logs_player',
    'cod_logs_error',
])
export type LogsBasic = z.infer<typeof LogsBasicSchema>

export const LogsSourceCacheSchema = z.enum(['cod_logs_cache'])
export type LogsSourceCache = z.infer<typeof LogsSourceCacheSchema>

export const LogsSourceOnlySchema = z.enum([
    ...LogsBasicSchema.options,

    'logs_request',
    'logs_request_error',
    'logs_request_auth',

    ...LogsSourceCacheSchema.options,
    'logs_ip',
    'cod_logs_search',
    'cod_logs_task_queues',
])
export type LogsSourceOnly = z.infer<typeof LogsSourceOnlySchema>

export const LogsSourceSchema = z.enum([...LogsSourceOnlySchema.options, C.ALL])
export type LogsSource = z.infer<typeof LogsSourceSchema>

export const LogsSearchSchema = z.object({
    id: z.number(),
    target: z.string(),
    uno: z.string().nullable(),
    data: z.array(PlayerSchema),
    time: z.string(),
})
export type LogsSearch = z.infer<typeof LogsSearchSchema>

export const LogsUniversalSchema = z.object({
    id: z.number(),
    target: z.string(),
    message: z.string(),
    data: z.record(z.string(), z.string().or(z.number()).optional()),
    time: z.string().datetime(),
})
export type LogsUniversal = z.infer<typeof LogsUniversalSchema>

export const LogsUniversalAllSchema = LogsUniversalSchema.extend({
    source: LogsSourceOnlySchema
})
export type LogsUniversalAll = z.infer<typeof LogsUniversalAllSchema>

export const IpDataSchema = z.object({
    status: z.string(),
    message: z.string().nullable(),
    country: z.string(),
    regionName: z.string(),
})
export type IpData = z.infer<typeof IpDataSchema>

export const LogsRequestDataSchema = z.object({
    ip: IpDataSchema,
    login: UserLoginSchema,
    detail: z.string().nullable(),
    trace: z.string().nullable(),
})
export type LogsRequestData = z.infer<typeof LogsRequestDataSchema>

export const LogsRequestSchema = z.object({
    id: z.number(),
    client: z.string().ip(),
    path: z.string(),
    user_agent: z.string(),
    data: LogsRequestDataSchema,
    time: z.string().datetime(),
})
export type LogsRequest = z.infer<typeof LogsRequestSchema>

export const LogsResponseSchema = z.object({
    logs: z.array(LogsUniversalAllSchema)
        .or(z.array(LogsUniversalSchema))
        .or(z.array(LogsRequestSchema))
        .or(z.array(LogsSearchSchema))
        .or(z.array(TaskSchema))
})
export type LogsResponse = z.infer<typeof LogsResponseSchema>

export const LogsTrackerSchema = z.object({
    target: z.string(),
    game_mode: GameModeSchema.nullable(),
    message: z.string(),
    time: z.string().datetime(),
})
export type LogsTracker = z.infer<typeof LogsTrackerSchema>

export const PlayerPlatformsSchema = z.object({
    uno: PlayerUnoSchema,
    acti: PlayerActiSchema.nullable(),
    battle: PlayerBattleSchema.nullable(),
})
export type PlayerPlatforms = z.infer<typeof PlayerPlatformsSchema>

export const LogsSearchDataSchema = PlayerPlatformsSchema.merge(z.object({
    username: z.array(z.string()),
}))
export type LogsSearchData = z.infer<typeof LogsSearchDataSchema>
