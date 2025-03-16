import { z } from 'zod'
import { C } from '@/app/components/Consts'
import {
    GameModeOnly,
    GameModeOnlySchema,
} from '@/app/components/zod/GameMode'
import { PlayerUno } from '@/app/components/zod/Uno'

export const GameStatusStatusSchema = z.nativeEnum({
    NOT_ENABLED: 0,
    ENABLED: 1,
    DISABLED: 2,
} as const)
export type GameStatusStatus = z.infer<typeof GameStatusStatusSchema>

export const PlayerParsedSchema = z.nativeEnum({
    NONE: 0,
    MATCHES: 1,
    FULLMATCHES: 2,
    ALL_AND_DISABLED: 3,
} as const)
// export type PlayerParsed = z.infer<typeof PlayerParsedSchema>

const GameStatusLogSchema = z.object({
    uno: z.string(),
    game_mode: GameModeOnlySchema,
    records: z.number().nonnegative(),
    source: z.string(),
    time: z.string().datetime(),
})
export type GameStatusLog = z.infer<typeof GameStatusLogSchema>

const MatchesStatsSchema = z.object({
    matches: z.number().nonnegative(),
    fullmatches: z.number().nonnegative(),
    played: z.number().nonnegative(),
}).and(z.record(
    z.string(), z.number().nonnegative()
))
export type MatchesStats = z.infer<typeof MatchesStatsSchema>

const GameStatusProtoSchema = {
    matches: z.object({
        stats: MatchesStatsSchema,
        logs: z.array(GameStatusLogSchema),
    }),
    stats: z.object({
        logs: z.array(GameStatusLogSchema),
    }),
}
export const GameStatusSchema = z.object({
    status: GameStatusStatusSchema,
    ...GameStatusProtoSchema
})
export type GameStatus = z.infer<typeof GameStatusSchema>

export const GameStatusAllSchema = z.object({
    status: PlayerParsedSchema,
    ...GameStatusProtoSchema
})
// type GameStatusAll = z.infer<typeof GameStatusAllSchema>

export const GamesStatusSchema = z.object({
    all: GameStatusAllSchema,
    mw_mp: GameStatusSchema,
    mw_wz: GameStatusSchema,
    cw_mp: GameStatusSchema,
    vg_mp: GameStatusSchema,
})
export type GamesStatus = z.infer<typeof GamesStatusSchema>

export const games_create = (
    uno: PlayerUno,
    game_statuses: Record<
        GameModeOnly,
        { status: GameStatusStatus, fullmatches: number }
    >,
    source: string,
) => {
    const log: GameStatusLog = {
        uno,
        game_mode: C.MW_MP,
        records: 0,
        source: `${games_create.name} ${source}`,
        time: new Date().toISOString(),
    }

    const games: GamesStatus = {
        all: {
            status: 0,
            matches: {
                stats: {
                    matches: 0,
                    fullmatches: Object.values(game_statuses).reduce(
                        (all, { fullmatches }) => all + fullmatches, 0
                    ),
                    played: 0,
                },
                logs: [log],
            },
            stats: { logs: [log] }
        },
        mw_mp: {
            status: game_statuses.mw_mp.status,
            matches: {
                stats: {
                    matches: 0,
                    fullmatches: game_statuses.mw_mp.fullmatches,
                    played: 0,
                },
                logs: [log],
            },
            stats: { logs: [log] }
        },
        mw_wz: {
            status: game_statuses.mw_mp.status,
            matches: {
                stats: {
                    matches: 0,
                    fullmatches: game_statuses.mw_wz.fullmatches,
                    played: 0,
                },
                logs: [{ ...log, game_mode: C.MW_WZ }],
            },
            stats: { logs: [{ ...log, game_mode: C.MW_WZ }] }
        },
        cw_mp: {
            status: game_statuses.mw_mp.status,
            matches: {
                stats: {
                    matches: 0,
                    fullmatches: game_statuses.cw_mp.fullmatches,
                    played: 0,
                },
                logs: [{ ...log, game_mode: C.CW_MP }],
            },
            stats: { logs: [{ ...log, game_mode: C.CW_MP }] }
        },
        vg_mp: {
            status: game_statuses.mw_mp.status,
            matches: {
                stats: {
                    matches: 0,
                    fullmatches: game_statuses.vg_mp.fullmatches,
                    played: 0,
                },
                logs: [{ ...log, game_mode: C.VG_MP }],
            },
            stats: { logs: [{ ...log, game_mode: C.VG_MP }] }
        },
    }

    return GamesStatusSchema.parse(games)
}