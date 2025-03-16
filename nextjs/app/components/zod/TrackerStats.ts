import { z } from 'zod'
import { C } from '@/app/components/Consts'
import { YearWzSchema } from '@/app/components/zod/Table'
import { z_record_strict } from '@/app/components/zod/Utils'
import { GameModeSchema } from '@/app/components/zod/GameMode'
import { MostPlayWithSchema } from '@/app/components/zod/MostPlayWith'

export const StatsRowSchema = z.object({
    rows: z.number(),
    last_id: z.number(),
})
export type StatsRow = z.infer<typeof StatsRowSchema>

export const TrackerStatsFullmatchesTypeSchema = z.object({
    all: StatsRowSchema,
    mw_mp: StatsRowSchema,
    mw_wz: z_record_strict(z.enum([C.ALL, ...YearWzSchema.options]), StatsRowSchema),
    cw_mp: StatsRowSchema,
    vg_mp: StatsRowSchema,
})
export type TrackerStatsFullmatchesType = z.infer<typeof TrackerStatsFullmatchesTypeSchema>

export const TrackerStatsNonMatchesSchema = z.object({
    players: StatsRowSchema,
    cod_logs: StatsRowSchema,
    cod_logs_error: StatsRowSchema,
    cod_logs_search: StatsRowSchema,
    cod_logs_task_queues: StatsRowSchema,
})
export type TrackerStatsNonMatches = z.infer<typeof TrackerStatsNonMatchesSchema>

export const TrackerStatsValueSchema = z.object({
    matches: z_record_strict(GameModeSchema, StatsRowSchema),
    fullmatches_main: TrackerStatsFullmatchesTypeSchema,
    fullmatches_basic: TrackerStatsFullmatchesTypeSchema,
    summary: z_record_strict(GameModeSchema, z.number()),
    non_matches: TrackerStatsNonMatchesSchema,
    most_play_with: MostPlayWithSchema,
})
export type TrackerStatsValue = z.infer<typeof TrackerStatsValueSchema>

export const TrackerStatsSchema = z.object({
    data: TrackerStatsValueSchema,
    time: z.string().datetime(),
})
export type TrackerStats = z.infer<typeof TrackerStatsSchema>
