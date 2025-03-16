import { z } from 'zod'
import { C } from '@/app/components/Consts'
import {
    PlayerUnoSchema,
    GroupUnoSchema,
} from '@/app/components/zod/Uno'
import { TaskSchema } from '@/app/components/zod/Task'
import {
    StatsRowSchema,
    TrackerStatsSchema,
} from '@/app/components/zod/TrackerStats'
import { MatchIDSchema } from '@/app/components/zod/Match'
import { GameModeSchema } from '@/app/components/zod/GameMode'

export const UpdatePlayersGameStatusSchema = z.number().or(
    z.enum(['pending', 'skipped', C.NOT_FOUND])
)
export const UpdatePlayersSchema = z.object({
    uno: PlayerUnoSchema,
    player: z.string(),
    group: GroupUnoSchema,
    mw_mp: UpdatePlayersGameStatusSchema,
    mw_wz: UpdatePlayersGameStatusSchema,
    cw_mp: UpdatePlayersGameStatusSchema,
    vg_mp: UpdatePlayersGameStatusSchema,
})
export type UpdatePlayers = z.infer<typeof UpdatePlayersSchema>

export const BaseStatsSchema = z.object({
    data: z.record(z.string(), StatsRowSchema),
    time: z.string().datetime(),
})
export type BaseStats = z.infer<typeof BaseStatsSchema>

export const TrackerStatusSchema = z.enum([C.ACTIVE, C.INACTIVE, 'break'])
export type TrackerStatus = z.infer<typeof TrackerStatusSchema>

export const PanelStatusesSchema = z.object({
    status: TrackerStatusSchema,
    monitor: z.boolean(),
    auto_update: z.boolean(),
    store_data: z.boolean(),
})
export type PanelStatuses = z.infer<typeof PanelStatusesSchema>

export const ResetTypeSchema = z.enum([
    C.PLAYERS,
    C.LOADOUT,
    C.CHART,
    C.TASK_QUEUES,
    C.UPDATE_PLAYERS,
    C.STATUS,
    C.MATCHES,
    C.MONITOR,
    'matches_stats',
    'base_stats',
    'tracker_stats',
    'clear_players_match_doubles',
    'auto_update',
    'store_data',
    'reboot',
    'shutdown',
])
export type ResetType = z.infer<typeof ResetTypeSchema>

export const ResetResponseSchema = z.object({
    time_taken: z.string(),
})
export type ResetResponse = z.infer<typeof ResetResponseSchema>

export const PanelSchema = z.object({
    time: z.string().nullable(),
    statuses: PanelStatusesSchema,
    pages: z.record(z.string(), z.number().nonnegative().nullable()),
    task_queues: z.array(TaskSchema),
    update_players: z.array(UpdatePlayersSchema),
    base_stats: BaseStatsSchema,
    tracker_stats: TrackerStatsSchema,
    resets: z.array(ResetTypeSchema),
    groups: z.array(GroupUnoSchema),
})
export type Panel = z.infer<typeof PanelSchema>


export const ClearFullmatchDoublesBodySchema = z.object({
    game_mode: GameModeSchema,
    matchID: MatchIDSchema,
})
export type ClearFullmatchDoublesBody = z.infer<typeof ClearFullmatchDoublesBodySchema>

export const ClearFullmatchDoublesResultSchema = z.object({
    uno: PlayerUnoSchema,
    username: z.string(),
})
export type ClearFullmatchDoublesResult = z.infer<typeof ClearFullmatchDoublesResultSchema>

export const ClearFullmatchesDoublesResponseSchema = z.object({
    message: z.string(),
    result: z.array(ClearFullmatchDoublesResultSchema),
})
export type ClearFullmatchesDoublesResponse = z.infer<typeof ClearFullmatchesDoublesResponseSchema>
