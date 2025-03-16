import { z } from 'zod'
import {
    PlayerDataBasicSchema,
    TargetDataStatsSchema,
} from '@/app/components/zod/Player'
import {
    GameStatsAllBasicKeysSchema,
    GameStatsAllBasicKeys,
    StatNameAllSchema,
} from '@/app/components/zod/GamesStats'
import { GamesStatusSchema } from '@/app/components/zod/GameStatus'
import {
    GroupUno,
    GroupUnoSchema,
    PlayerUnoSchema,
    Uno,
} from '@/app/components/zod/Uno'
import { GameSchema } from '@/app/components/zod/GameMode'

export const GameStatsBestPlayerRecordSchema = z.object({
    uno: PlayerUnoSchema,
    value: z.number().nonnegative(),
})
export type GameStatsBestPlayerRecord = z.infer<typeof GameStatsBestPlayerRecordSchema>

const GameStatsBestSimpleSchema = z.object(
    Object.fromEntries(
        GameStatsAllBasicKeysSchema.options.map(key => [key, GameStatsBestPlayerRecordSchema])
    ) as Record<GameStatsAllBasicKeys, typeof GameStatsBestPlayerRecordSchema>,
).catchall(GameStatsBestPlayerRecordSchema.optional())
export type GameStatsBestSimple = z.infer<typeof GameStatsBestSimpleSchema>

const GameStatsBestDataSchema = z.object({
    all: z.record(StatNameAllSchema, GameStatsBestPlayerRecordSchema),
}).catchall(z.record(StatNameAllSchema, GameStatsBestPlayerRecordSchema))

const GameStatsBestSchema = z.object({
    all: GameStatsBestSimpleSchema,
    all_additional: z.record(z.string(), GameStatsBestPlayerRecordSchema.optional()).optional(),
    scorestreak: GameStatsBestDataSchema,
}).catchall(GameStatsBestDataSchema.optional())
export type GameStatsBest = z.infer<typeof GameStatsBestSchema>

const GroupBasicSchema = z.object({
    uno: GroupUnoSchema,
    username: z.array(z.string()),
    clantag: z.array(z.string()),
    games: GamesStatusSchema,
    players: z.record(z.string(), PlayerDataBasicSchema),
})
export type GroupBasic = z.infer<typeof GroupBasicSchema>

export const GroupDataSchema = GroupBasicSchema.merge(TargetDataStatsSchema).merge(z.object({
    games_stats_best: z.record(GameSchema, GameStatsBestSchema.optional()),
}))
export type GroupData = z.infer<typeof GroupDataSchema>

export const is_group_uno = (uno: Uno): uno is GroupUno => (
    GroupUnoSchema.safeParse(uno).success
)
