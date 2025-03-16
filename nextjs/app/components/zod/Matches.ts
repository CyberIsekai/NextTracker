import { z } from 'zod'
import { GameModeOnlySchema } from '@/app/components/zod/GameMode'
import { LabelDataSchema } from '@/app/components/zod/Label'
import {
    GameBasicColumnSchema,
    MatchIDSchema,
    MatchLoadoutDataStatsSchema,
    MatchResultSchema,
} from '@/app/components/zod/Match'
import { MatchesSourceSchema } from '@/app/components/zod/MatchesSource'

export const MatchesGameBasicStatsSchema = z.record(
    GameBasicColumnSchema, z.number().nonnegative()
).refine((game_basic_columns): game_basic_columns is Required<typeof game_basic_columns> =>
    GameBasicColumnSchema.options.every(
        basic_column => game_basic_columns[basic_column] != null
    ),
)
export type MatchesGameBasicStats = z.infer<typeof MatchesGameBasicStatsSchema>

export const MatchesDataSchema = z.intersection(
    MatchesGameBasicStatsSchema,
    z.object({
        id: z.number(),
        game_mode: GameModeOnlySchema,
        matchID: MatchIDSchema,
        map: LabelDataSchema,
        mode: LabelDataSchema,
        result: MatchResultSchema,
        player: z.string(),
        loadout: z.record(z.string(), z.number().nonnegative()),
        weaponStats: z.array(MatchLoadoutDataStatsSchema).optional(),
        source: MatchesSourceSchema,
        time: z.string().datetime(),
    })
)
export type MatchesData = z.infer<typeof MatchesDataSchema>

export const DateDataSchema = z.object({
    win: z.number().nonnegative(),
    loss: z.number().nonnegative(),
    draw: z.number().nonnegative(),
    matches: z.array(MatchesDataSchema),
    stats: MatchesGameBasicStatsSchema,
    loadout: z.record(z.string(), z.number().nonnegative()),
    is_same_map: z.boolean(),
})
export type DateData = z.infer<typeof DateDataSchema>

export const MatchesResponseSchema = z.object({
    matches: z.array(MatchesDataSchema),
    found: z.number(),
})
export type MatchesResponse = z.infer<typeof MatchesResponseSchema>
