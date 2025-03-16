import { z } from 'zod'

import { C } from '@/app/components/Consts'
import { GamesStatusSchema } from '@/app/components/zod/GameStatus'
import { ChartSchema } from '@/app/components/zod/Chart'
import { GamesStatsSchema } from '@/app/components/zod/GamesStats'
import { MostPlayWithSchema } from '@/app/components/zod/MostPlayWith'
import { LoadoutSchema } from '@/app/components/zod/Loadout'
import {
    GameModeSchema,
    GameSchema,
    ModeSchema,
} from '@/app/components/zod/GameMode'
import {
    PlatformSchema,
    MessageStatusSchema,
} from '@/app/components/zod/Main'
import {
    GroupUnoSchema,
    PlayerUnoSchema,
} from '@/app/components/zod/Uno'

export const TargetDataStatsSchema = z.object({
    games_stats: GamesStatsSchema,
    chart: ChartSchema.nullable(),
    most_play_with: MostPlayWithSchema.nullable(),
    loadout: LoadoutSchema.nullable(),
})

export const PlayerActiSchema = z.string().regex(/^.+?#\d+$/)
export type PlayerActi = z.infer<typeof PlayerActiSchema>

export const PlayerBattleSchema = z.string().regex(/^.+?#\d+$/)
export type PlayerBattle = z.infer<typeof PlayerBattleSchema>

export const PlayerDataBasicSchema = z.object({
    uno: PlayerUnoSchema,
    username: z.array(z.string()),
    clantag: z.array(z.string()),
    games: GamesStatusSchema,
})
export type PlayerDataBasic = z.infer<typeof PlayerDataBasicSchema>

const PlayerBasicSchema = PlayerDataBasicSchema.extend({
    id: z.number(),
    acti: z.string().nullable(),
    battle: z.string().nullable(),
    group: z.string().nullable(),
    time: z.date(),
})
export type PlayerBasic = z.infer<typeof PlayerBasicSchema>

export const PlayerGroupSchema = z.string()
    .nullable()
    .refine(val => val === null || val !== '', {
        message: 'is empty'
    })
    .refine(val => val === null || !/^\d+$/.test(val), {
        message: 'can\'t be a number'
    })
    .refine(val => val === null || !val.includes(' '), {
        message: 'must not contain spaces'
    })
    .refine(val => val === null || val.length > +process.env.GROUP_NAME_LENGTH_REQUIRED!, {
        message: 'too short'
    })
    .refine(val => val === null || val.length < +process.env.GROUP_NAME_LENGTH_LIMIT!, {
        message: 'too long'
    })
    .refine(
        val => {
            const FORBIDDEN_NAMES: string[] = [
                C.TRACKER,
                ...GameSchema.options,
                ...ModeSchema.options,
                ...GameModeSchema.options,
            ]
            return val === null || !FORBIDDEN_NAMES.includes(val.toLowerCase())
        },
        val => ({ message: `can't be [${val}]` }),
    )

export const PlayerDataSchema = PlayerDataBasicSchema
    .and(TargetDataStatsSchema)
    .and(z.object({ group: PlayerGroupSchema }))
export type PlayerData = z.infer<typeof PlayerDataSchema>

export const PlayerSchema = PlayerBasicSchema
    .and(TargetDataStatsSchema)
    .and(z.object({ data: z.record(z.string(), z.string()) }))
export type Player = z.infer<typeof PlayerSchema>

export const PlayerSearchSchema = z.object({
    platform: PlatformSchema,
    target: z.string(),
    uno: PlayerUnoSchema.nullable(),
})
export type PlayerSearch = z.infer<typeof PlayerSearchSchema>

export const PlayerAddSchema = z.object({
    group: GroupUnoSchema,
    uno: PlayerUnoSchema,
})
export type PlayerAdd = z.infer<typeof PlayerAddSchema>

export const SearchRespBasicSchema = z.object({
    message: z.string(),
    status: MessageStatusSchema,
    result: z.string().or(PlayerSchema).nullable(),
    time: z.string().datetime(),
})

export const SearchRespSchema = SearchRespBasicSchema.merge(z.object({
    result: z.string().or(PlayerSchema).or(z.array(SearchRespBasicSchema)).nullable(),
}))

export type SearchResp = z.infer<typeof SearchRespSchema>
