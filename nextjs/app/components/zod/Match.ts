import { z } from 'zod'
import { C } from '@/app/components/Consts'
import { z_record_strict } from '@/app/components/zod/Utils'
import { LabelDataSchema } from '@/app/components/zod/Label'
import { PlayerUnoSchema } from '@/app/components/zod/Uno'
import { MatchesSourceSchema } from '@/app/components/zod/MatchesSource'
import { YearSchema } from '@/app/components/zod/Table'
import { GameModeOnlySchema } from '@/app/components/zod/GameMode'

export const MatchColumnSchema = z.enum([
    C.TIME_PLAYED,
    C.KILLS,
    C.DEATHS,
    C.KDRATIO,
    C.HEADSHOTS,
    'damageDone',
    'longestStreak',
    'assists',
    'score',
    'scorePerMinute',
])
export type MatchColumn = z.infer<typeof MatchColumnSchema>

export const GameBasicColumnSchema = z.enum([
    C.DURATION,
    ...MatchColumnSchema.options,
])
export type GameBasicColumn = z.infer<typeof GameBasicColumnSchema>

export const MatchResultMpSchema = z.nativeEnum({
    DRAW: 0,
    WIN: 1,
    LOSS: 2,
} as const)
export type MatchResultMp = z.infer<typeof MatchResultMpSchema>

export const MATCH_RESULT_MP = {
    [MatchResultMpSchema.enum.DRAW]: 'draw',
    [MatchResultMpSchema.enum.WIN]: 'win',
    [MatchResultMpSchema.enum.LOSS]: 'loss',
} as const

export const MatchResultSchema = MatchResultMpSchema.or(z.number().nonnegative())
export type MatchResult = z.infer<typeof MatchResultSchema>

export const MatchLoadoutDataWeaponStatsSchema = z.object({
    kills: z.number(),
    deaths: z.number(),
    hits: z.number(),
    shots: z.number(),
    headshots: z.number(),
    xpEarned: z.number(),
    startingWeaponXp: z.number(),
})
export type MatchLoadoutDataWeaponStats = z.infer<typeof MatchLoadoutDataWeaponStatsSchema>
export const MatchLoadoutDataStatsSchema = LabelDataSchema.merge(z.object({
    stats: MatchLoadoutDataWeaponStatsSchema,
}))
export type MatchLoadoutDataStats = z.infer<typeof MatchLoadoutDataStatsSchema>

export const MatchIDSchema = z.string()
    .regex(/^\d+$/, { message: `${C.MATCHID} must be a numeric string` })
    .describe(`${C.MATCHID} identifier consisting of only numeric characters`)
    .readonly()
export type MatchID = z.infer<typeof MatchIDSchema>

export const MatchParamsOrderSchema = z.enum([
    C.RESULT,
    `-${C.RESULT}`,
    ...MatchColumnSchema.options,
    ...MatchColumnSchema.options.map(v => `-${v}` as const),
])
export type MatchParamsOrder = z.infer<typeof MatchParamsOrderSchema>

export const MatchParamsSchema = z.object({
    order: MatchParamsOrderSchema.optional(),
    follow: z.string().optional(),
    team: z.boolean().optional(),
})
export type MatchParams = z.infer<typeof MatchParamsSchema>

export const MatchLoadoutWeaponSchema = LabelDataSchema.merge(z.object({
    attachments: z.array(LabelDataSchema),
}))
export type MatchLoadoutWeapon = z.infer<typeof MatchLoadoutWeaponSchema>

export const MatchLoadoutSchema = z.object({
    primaryWeapon: MatchLoadoutWeaponSchema,
    secondaryWeapon: MatchLoadoutWeaponSchema,
    perks: z.array(LabelDataSchema),
    killstreaks: z.array(LabelDataSchema),
    tactical: LabelDataSchema.nullable(),
    lethal: LabelDataSchema.nullable(),
})
export type MatchLoadout = z.infer<typeof MatchLoadoutSchema>

export const MatchStatsSchema = z_record_strict(MatchColumnSchema, z.number().nonnegative())
export type MatchStats = z.infer<typeof MatchStatsSchema>

export const MatchPlayerSchema = z.object({
    id: z.number(),
    uno: PlayerUnoSchema,
    username: z.string(),
    clantag: z.string().nullable(),
    result: MatchResultSchema,
    stats: MatchStatsSchema,
})
export type MatchPlayer = z.infer<typeof MatchPlayerSchema>

export const MatchStatsPlayerSchema = z.object({
    id: z.number(),
    uno: PlayerUnoSchema,
    username: z.string(),
    clantag: z.string().nullable(),
    result: MatchResultSchema,

    stats: z.record(z.string(), z.number().or(z.string())),
    matchID: MatchIDSchema,
    map: LabelDataSchema,
    mode: LabelDataSchema,
    loadout: z.array(MatchLoadoutSchema),
    weaponStats: z.array(MatchLoadoutDataStatsSchema),
    source: MatchesSourceSchema,
    time: z.string().datetime(),
})
export type MatchStatsPlayer = z.infer<typeof MatchStatsPlayerSchema>

export const TeamDataSchema = z.object({
    name: z.string(),
    players: z.array(MatchPlayerSchema),
    result: MatchResultSchema,
    stats: MatchStatsSchema,
})
export type TeamData = z.infer<typeof TeamDataSchema>

export const MatchDataSchema = z.object({
    map: LabelDataSchema,
    mode: LabelDataSchema,
    duration: z.string().duration(),
    time: z.string().datetime(),
    source: MatchesSourceSchema,
    stats: MatchStatsSchema,
    team: z.array(TeamDataSchema),
})
export type MatchData = z.infer<typeof MatchDataSchema>

export const MatchBodySchema = z.object({
    game_mode: GameModeOnlySchema,
    match_id: z.number().nonnegative(),
    source: MatchesSourceSchema,
    year: YearSchema,
})
export type MatchBody = z.infer<typeof MatchBodySchema>

export const MatchBasicColumnSchema = z.enum([
    C.ID,
    C.UNO,
    C.USERNAME,
    C.TEAM,
    ...GameBasicColumnSchema.options,
])
// export type MatchBasicColumn = z.infer<typeof MatchBasicColumnSchema>

export const MATCH_META = [C.TIME, C.MODE, C.MAP, C.DURATION] as const
export const MATCH_COLUMNS = {
    mw_mp: {
        basic: [...MatchBasicColumnSchema.options, C.CLANTAG],
        meta: [...MATCH_META, 'team1Score', 'team2Score'],
    },
    mw_wz: {
        basic: [...MatchBasicColumnSchema.options, C.CLANTAG],
        meta: MATCH_META,
    },
    cw_mp: {
        basic: MatchBasicColumnSchema.options,
    },
    vg_mp: {
        basic: MatchBasicColumnSchema.options,
    },
} as const
