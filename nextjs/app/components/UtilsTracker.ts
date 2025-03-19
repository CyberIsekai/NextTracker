'use server'

import {
    eq,
    sql,
    and,
    gt,
    inArray,
    isNotNull,
    desc,
} from 'drizzle-orm'
import csv from 'csv-parser'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { Transform } from 'stream'
import { pipeline } from 'stream/promises'
import { Socket } from 'net'
import * as fs from 'fs'
import * as schema from '@/app/components/drizzle/schema'
import redis_manage from '@/app/components/Redis'
import { db } from '@/app/components/drizzle/db'
import {
    C,
    TIME_LOAD_DELAY,
} from '@/app/components/Consts'
import {
    PlayerData,
    PlayerBasic,
    Player,
    PlayerDataBasic,
} from '@/app/components/zod/Player'
import {
    GameStatsBest,
    GameStatsBestSimple,
    GroupBasic,
    GroupData,
    is_group_uno,
} from '@/app/components/zod/Group'
import {
    GamesStatus,
    GameStatus,
    MatchesStats,
    GameStatusStatusSchema,
    PlayerParsedSchema,
    games_create,
} from '@/app/components/zod/GameStatus'
import { Chart } from '@/app/components/zod/Chart'
import {
    UpdateRouterDataType,
    Router,
    RouterSchema,
    DataTypeOnly,
} from '@/app/components/zod/Router'
import { get_file_path } from '@/app/components/TrackerGameData'
import {
    is_number,
    is_best_record,
    is_player,
    is_group,
    is_game_mode_mw,
    target_type_define,
} from '@/app/components/UtilsValidators'
import {
    extract_ratio,
} from '@/app/components/Utils'
import {
    config_get,
    in_logs,
    seconds_wait_expire,
    get_stats_row,
    set_table_sequence,
} from '@/app/components/UtilsBase'
import {
    CacheKey,
    CacheMatchesUid,
} from '@/app/components/zod/Redis'
import {
    TargetType,
} from '@/app/components/zod/Main'
import {
    StatsRow,
    TrackerStats,
    TrackerStatsFullmatchesType,
    TrackerStatsValue,
} from '@/app/components/zod/TrackerStats'
import {
    Uno,
    PlayerUno,
    PlayerUnoSchema,
    GroupUno,
} from '@/app/components/zod/Uno'
import {
    Task,
    TaskNameSchema,
    TaskStatusSchema,
    TaskStatusResponceSchema,
    TaskStatusResponce,
} from '@/app/components/zod/Task'
import { LogsTracker } from '@/app/components/zod/Logs'
import {
    Game,
    GameSchema,
    Mode,
    GameMode,
    GameModeSchema,
    GameModeMap,
    GAME_MODES,
    GameOnly,
    GameModeOnly,
    GameModeMw,
    GameModeOnlySchema,
    GameModeMwSchema,
    game_mode_split,
} from '@/app/components/zod/GameMode'
import {
    GamesStats,
    GameStats,
    GameStatsData,
    GameStatsDataKeySchema,
    GameStatsDataKeySimpleSchema,
    GameStatsDataLifetime,
    GameStatsDataLifetimeCW,
    GameStatsDataWeaponValue,
    GameStatsSchema,
    StatNameAll,
    StatNameAttachment,
} from '@/app/components/zod/GamesStats'
import {
    MostCommonUnoData,
    MostPlayWith,
    MostPlayWithData,
} from '@/app/components/zod/MostPlayWith'
import { Loadout } from '@/app/components/zod/Loadout'
import { TableCsv } from '@/app/components/zod/Table'
import {
    get_game_table,
    get_game_tables,
} from '@/app/components/Table'
import {
    MATCH_COLUMNS,
    MatchColumnSchema,
    MatchID,
    MatchPlayerSchema,
} from '@/app/components/zod/Match'

export const add_to_task_queues = async (
    uno: Uno,
    game_mode: GameMode,
    data_type: UpdateRouterDataType,
) => {
    const name = TaskNameSchema.parse(`${uno} ${game_mode} ${data_type}`)
    const task_queues = await redis_manage(C.TASK_QUEUES, 'lrange')

    let task_status: TaskStatusResponce

    if (!task_queues.length) {
        task_status = TaskStatusResponceSchema.enum.STARTED
    } else if (
        task_queues[0].name === name &&
        task_queues[0].status === TaskStatusSchema.enum.RUNNING
    ) {
        task_status = TaskStatusResponceSchema.enum.ALREADY_RUNNING
    } else if (name in task_queues.map(task => task.name)) {
        task_status = TaskStatusResponceSchema.enum.IN_QUEUES
    } else {
        task_status = TaskStatusResponceSchema.enum.ADDED
    }

    if (
        task_status === TaskStatusResponceSchema.enum.STARTED ||
        task_status === TaskStatusResponceSchema.enum.ADDED
    ) {
        const task: Task = {
            id: 0,
            name,
            uno,
            game_mode,
            data_type,
            status: TaskStatusSchema.enum.PENDING,
            data: {},
            time: new Date().toISOString(),
            time_started: null,
            time_end: null,
        }

        const player_uno = PlayerUnoSchema.safeParse(uno)
        if (player_uno.success) {
            const [username, games] = await redis_manage(
                `${C.PLAYER}:${C.UNO}_${player_uno.data}`, 'hmget', [C.USERNAME, C.GAMES]
            ) as [PlayerData['username'], PlayerData['games']] | [null, null]
            if (username) {
                task.data.username = username[0]
                task.data.player_status = games.all.status
                task.data.game_status = games[game_mode].status
            }
        }

        await redis_manage(C.TASK_QUEUES, 'rpush', task)
    }

    return task_status
}

export async function matches_stats_game_mode_count(uno: PlayerUno, game_mode: GameModeOnly) {
    // Get all matches matchID for player
    const table_matches = await get_game_table(game_mode, C.MATCHES)
    const matches_ids = (
        await db.selectDistinct({ matchID: table_matches.matchID })
            .from(table_matches)
            .where(eq(table_matches.uno, uno))
    ).map(match => match.matchID)

    const matches_stats: MatchesStats = {
        matches: matches_ids.length,
        fullmatches: 0,
        played: await get_played_stat(uno, game_mode),
    }

    if (is_game_mode_mw(game_mode)) {
        if (matches_ids.length) {
            // Count how matches already parsed in fullmatches_main tables
            const tables_fullmatches_main = await get_game_tables(game_mode, C.MAIN)
            for (const t of tables_fullmatches_main) {
                const fullmatches_rows = (
                    await db.select({ count: sql<number>`count(*)::int` })
                        .from(t.table)
                        .where(inArray(t.table.matchID, matches_ids))
                )[0].count

                matches_stats.fullmatches += fullmatches_rows
            }
        }
    }

    return matches_stats
}

export async function player_get(uno: PlayerUno, column_type: C.BASIC, source: string): Promise<PlayerBasic | undefined>
export async function player_get(uno: PlayerUno, column_type: C.ALL, source: string): Promise<Player | undefined>
export async function player_get(uno: PlayerUno, column_type: C.GAMES, source: string): Promise<GamesStatus | null>
export async function player_get(uno: PlayerUno, column_type: C.GAMES_STATS, source: string): Promise<GamesStats | null>
export async function player_get(
    uno: PlayerUno,
    column_type: C.BASIC | C.ALL | C.GAMES_STATS | C.GAMES,
    source: string,
) {
    in_logs(
        uno,
        `${player_get.name} ${column_type} ${source}`,
        'cod_logs_player',
    )

    const where = eq(schema.cod_players.uno, uno)

    if (column_type === C.BASIC) {
        const player: PlayerBasic | undefined = await db.query.cod_players.findFirst({
            columns: {
                id: true,
                uno: true,
                acti: true,
                battle: true,
                username: true,
                clantag: true,
                group: true,
                games: true,
                time: true,
            },
            extras: ({ time }) => ({ time: sql<string>`${time}::timestamp`.as(C.ISO) }),
            where,
        })
        return player
    }

    if (column_type === C.ALL) {
        const player: Player | undefined = await db.query.cod_players.findFirst({
            // extras: ({ time }) => ({ time: sql<string>`${time}::timestamp`.as(C.ISO) }),
            where,
        })
        return player
    }

    if (column_type === C.GAMES) {
        const player = await db.query.cod_players.findFirst({
            columns: { games: true },
            where,
        })
        return player?.games || null
    }

    if (column_type === C.GAMES_STATS) {
        const player = await db.query.cod_players.findFirst({
            columns: { games_stats: true },
            where,
        })
        return player?.games_stats || null
    }
}
export const player_update = async <T extends typeof schema.cod_players>(
    uno: PlayerUno,
    data: Partial<{ [K in keyof T['$inferInsert']]?: T['$inferInsert'][K] }>,
    source: string,
) => {
    await db
        .update(schema.cod_players)
        .set(data)
        .where(eq(schema.cod_players.uno, uno))
    in_logs(uno, `${player_update.name} ${Object.keys(data)} ${source}`, 'cod_logs_player')
}

export async function player_matches_stats_update(
    uno: PlayerUno, game_mode: GameMode
): Promise<GamesStatus> {
    const games = await redis_manage(`${C.PLAYER}:${C.UNO}_${uno}`, 'hget', C.GAMES)
    if (!games) throw new Error(`[${uno}] ${C.NOT_FOUND}`)

    if (game_mode === C.ALL) {
        for (const game_mode of await game_modes_get_list()) {
            games[game_mode].matches.stats = await matches_stats_game_mode_count(
                uno, game_mode
            )
        }
    } else {
        games[game_mode].matches.stats = await matches_stats_game_mode_count(
            uno, game_mode
        )
    }

    // reset and summary all matches stats
    games.all.matches.stats = {
        matches: 0,
        fullmatches: 0,
        played: 0,
    }
    for (const game_mode of await game_modes_get_list()) {
        for (const [stat_name, stat_value] of Object.entries(games[game_mode].matches.stats)) {
            games.all.matches.stats[stat_name] += stat_value
        }
    }

    set_games(uno, games)

    return games
}

export const update_matches_stats = async () => {
    for (const uno of await target_unos_get(C.PLAYER)) {
        await player_matches_stats_update(uno, C.ALL)
    }
    await players_cache_update()
}

const group_players = async (
    uno: GroupUno,
    players: typeof schema.cod_players.$inferSelect[]
) => {
    const [chart, most_play_with, loadout] = await redis_manage(
        `${C.GROUP}:${C.UNO}_${uno}`,
        'hmget',
        [C.CHART, C.MOST_PLAY_WITH, C.LOADOUT],
    ) as [Chart, MostPlayWith, Loadout]

    const group: GroupData = {
        uno,
        username: [],
        clantag: [],
        games: await group_players_games(players.map(player => player.games)),
        games_stats: {},
        games_stats_best: {},
        chart,
        most_play_with,
        loadout,
        players: {},
    }

    for (const player of players) {
        group.username = [
            ...group.username,
            ...player.username.filter(username => !group.username.includes(username))
        ]
        group.clantag = [
            ...group.clantag,
            ...player.clantag.filter(clantag => !group.clantag.includes(clantag))
        ]
        group.players[player.uno] = {
            uno: player.uno,
            username: player.username,
            clantag: player.clantag,
            games: player.games,
        }
    }

    for (const game of GameSchema.options) {
        const games_stats = {} as GameStats
        const games_stats_best = {} as GameStatsBest

        for (const player of players) {

            for (const stats_name of GameStatsDataKeySimpleSchema.options) {
                const player_stat = player.games_stats[game]?.[stats_name]
                if (!player_stat) continue

                const games_stat = games_stats[stats_name] ?? {}
                const games_stat_best = (games_stats_best[stats_name] ?? {}) as GameStatsBestSimple

                for (const [stat_name, value] of Object.entries(player_stat)) {
                    if (!value) continue
                    let stat_current: number = games_stat[stat_name] ?? 0
                    const stat_best = games_stat_best[stat_name] ?? { uno: player.uno, value }

                    if (is_best_record(stat_name)) {
                        if (value > stat_current) { // replace if better than previous
                            stat_current = value
                        }
                    } else { // summary stat value
                        stat_current += value
                    }

                    if (value > stat_best.value) {
                        stat_best.uno = player.uno
                        stat_best.value = value
                    }

                    games_stat[stat_name] = stat_current
                    games_stat_best[stat_name] = stat_best
                }

                games_stats[stats_name] = await correct_ratio(games_stat)
                games_stats_best[stats_name] = games_stat_best
            }

            for (const stats_name of [...GameStatsDataKeySchema.options, 'scorestreak'] as const) {
                const player_stat = player.games_stats[game]?.[stats_name]
                if (!player_stat) continue

                const games_stat = games_stats[stats_name] ?? { all: {} }
                const games_stat_best = games_stats_best[stats_name] ?? { all: {} }

                for (const [weapon_name, weapon_value] of Object.entries(player_stat)) {
                    const stat_current = games_stat[weapon_name] ?? {}
                    const stat_best = games_stat_best[weapon_name] ?? {}

                    for (const [k, value] of Object.entries(weapon_value!)) {
                        const stat_name = k as StatNameAll
                        stat_current[stat_name] = (stat_current[stat_name] ?? 0) + value

                        if (value > (stat_best[stat_name]?.value ?? 0)) {
                            stat_best[stat_name] = { uno: player.uno, value }
                        }
                    }

                    games_stat[weapon_name] = await correct_ratio(stat_current)
                    games_stat_best[weapon_name] = stat_best
                }

                games_stats[stats_name] = games_stat
                games_stats_best[stats_name] = games_stat_best
            }
        }

        if (Object.keys(games_stats).length) {
            group.games_stats[game] = games_stats
            group.games_stats_best[game] = games_stats_best
        }
    }

    return group
}

export const tracker_stats_summary = async (tracker: GroupData) => {
    const { data } = await tracker_stats_get()
    tracker.most_play_with = data.most_play_with

    // reset matches stats for tracker
    for (const game_mode of await game_modes_get_list(C.ALL, C.ALL)) {
        tracker.games[game_mode].matches.stats = {
            matches: 0,
            fullmatches: 0,
            played: 0,
        }
    }

    const mw_mp = tracker.games.mw_mp.matches.stats
    const mw_wz = tracker.games.mw_wz.matches.stats

    // set matches
    for (const game_mode of GameModeSchema.options) {
        const rows = data.matches[game_mode].rows
        tracker.games[game_mode].matches.stats.matches = rows
    }

    // set fullmatches
    mw_mp.fullmatches = (
        data.fullmatches_main.mw_mp.rows + data.fullmatches_basic.mw_mp.rows
    )
    mw_wz.fullmatches = [
        ...Object.values(data.fullmatches_main.mw_wz),
        ...Object.values(data.fullmatches_basic.mw_wz),
    ].reduce((rows, stat) => rows + stat.rows, 0)
    tracker.games.all.matches.stats.fullmatches = (
        mw_mp.fullmatches + mw_wz.fullmatches
    )

    return tracker
}

export const tracker_stats_get = async (): Promise<TrackerStats> => {
    const stats_saved = await config_get(C.STATS, C.TRACKER)
    const seconds_wait = await seconds_wait_expire(
        stats_saved.time,
        +process.env.STATS_INTERVAL_WEEKS! * 24 * 60 * 60
    )

    if (!Object.keys(stats_saved.data).length || !seconds_wait) {
        return tracker_stats_update()
    }

    return {
        data: stats_saved.data,
        time: stats_saved.time.toISOString()
    }
}

export const tracker_stats_update = async (): Promise<TrackerStats> => {
    // Count and save rows for every game table, with last added id

    const matches: Record<GameMode, StatsRow> = {
        [C.ALL]: await get_stats_row(null),
        [C.MW_MP]: await get_stats_row(schema.cod_matches_mw_mp),
        [C.MW_WZ]: await get_stats_row(schema.cod_matches_mw_wz),
        [C.CW_MP]: await get_stats_row(schema.cod_matches_cw_mp),
        [C.VG_MP]: await get_stats_row(schema.cod_matches_vg_mp),
    }
    matches.all.rows = Object.values(matches).reduce(
        (rows, stat) => rows + stat.rows, 0
    )

    const fullmatches_main: TrackerStatsFullmatchesType = {
        [C.ALL]: await get_stats_row(null),
        [C.MW_MP]: await get_stats_row(schema.cod_fullmatches_mw_mp),
        [C.MW_WZ]: {
            [C.ALL]: await get_stats_row(null),
            '2020': await get_stats_row(schema.cod_fullmatches_mw_wz_2020),
            '2021': await get_stats_row(schema.cod_fullmatches_mw_wz_2021),
            '2022': await get_stats_row(schema.cod_fullmatches_mw_wz_2022),
            '2023': await get_stats_row(schema.cod_fullmatches_mw_wz_2023),
        },
        [C.CW_MP]: await get_stats_row(null),
        [C.VG_MP]: await get_stats_row(null),
    }
    fullmatches_main.mw_wz.all.rows = Object.values(fullmatches_main.mw_wz).reduce(
        (rows, stat) => rows + stat.rows, 0
    )
    fullmatches_main.all.rows = (
        fullmatches_main.mw_mp.rows + fullmatches_main.mw_wz.all.rows
    )

    const fullmatches_basic: TrackerStatsFullmatchesType = {
        [C.ALL]: await get_stats_row(null),
        [C.MW_MP]: await get_stats_row(schema.cod_fullmatches_basic_mw_mp),
        [C.MW_WZ]: {
            [C.ALL]: await get_stats_row(null),
            '2020': await get_stats_row(schema.cod_fullmatches_basic_mw_wz_2020),
            '2021': await get_stats_row(schema.cod_fullmatches_basic_mw_wz_2021),
            '2022': await get_stats_row(schema.cod_fullmatches_basic_mw_wz_2022),
            '2023': await get_stats_row(schema.cod_fullmatches_basic_mw_wz_2023),
        },
        [C.CW_MP]: await get_stats_row(null),
        [C.VG_MP]: await get_stats_row(null),
    }
    fullmatches_basic.mw_wz.all.rows = Object.values(fullmatches_basic.mw_wz).reduce(
        (rows, stat) => rows + stat.rows, 0
    )
    fullmatches_basic.all.rows = (
        fullmatches_basic.mw_mp.rows + fullmatches_basic.mw_wz.all.rows
    )

    const summary = {
        [C.ALL]: 0,
        [C.MW_MP]: 0,
        [C.MW_WZ]: 0,
        [C.CW_MP]: 0,
        [C.VG_MP]: 0,
    }
    // summary matches
    for (const game_mode of await game_modes_get_list()) {
        summary[game_mode] += matches[game_mode].rows
    }
    // summary fullmatches
    summary.mw_mp += fullmatches_main.mw_mp.rows
    summary.mw_wz += fullmatches_main.mw_wz.all.rows
    summary.mw_mp += fullmatches_basic.mw_mp.rows
    summary.mw_wz += fullmatches_basic.mw_wz.all.rows

    summary.all = Object.values(summary).reduce(
        (rows, stat) => rows + stat, 0
    )

    const data: TrackerStatsValue = {
        matches,
        fullmatches_main,
        fullmatches_basic,
        summary,
        non_matches: {
            players: await get_stats_row(schema.cod_players),
            cod_logs: await get_stats_row(schema.cod_logs),
            cod_logs_error: await get_stats_row(schema.cod_logs_error),
            cod_logs_search: await get_stats_row(schema.cod_logs_search),
            cod_logs_task_queues: await get_stats_row(schema.cod_logs_task_queues),
        },
        most_play_with: await most_play_with_update(),
    }

    const time = new Date()

    await db.update(schema.configs)
        .set({ data, time })
        .where(and(
            eq(schema.configs.name, C.STATS),
            eq(schema.configs.source, C.TRACKER),
        ))

    return { data, time: time.toISOString() }
}

export const get_played_stat = async (
    uno: PlayerUno, game_mode: GameModeOnly
): Promise<number> => {
    const game_stats = await game_stats_get(uno, game_mode)
    const played = game_stats?.all.totalGamesPlayed ?? 0

    return played
}

export const game_stats_get = async (uno: Uno, game_mode: GameMode) => {
    const target_type = target_type_define(uno)
    const games_stats = await redis_manage(
        `${target_type}:${C.UNO}_${uno}`, 'hget', C.GAMES_STATS
    )
    const [game] = game_mode_split(game_mode)
    return games_stats?.[game]
}

export const player_stats_get = async (uno: PlayerUno, game_mode: GameMode) => {
    const game_stats = await game_stats_get(uno, game_mode)

    if (game_stats) return game_stats

    if (game_mode !== C.ALL) {
        const games = await redis_manage(`${C.PLAYER}:${C.UNO}_${uno}`, 'hget', C.GAMES)

        if (!games) {
            throw new Error(`${C.PLAYER} ${C.UNO} [${uno}] ${C.NOT_FOUND}`)
        }

        if (games[game_mode].status === GameStatusStatusSchema.enum.NOT_ENABLED) {
            throw new Error(`[${uno}] ${game_mode} not ${C.ENABLED}`)
        }

        add_to_task_queues(uno, game_mode, C.STATS)
    }

    throw new Error(`${C.STATS} ${game_mode} ${C.NOT_FOUND}`)
}

export const games_summary = async (games: GamesStatus) => {
    // reset and summary all logs and stats
    games.all.stats.logs = []
    games.all.matches.logs = []
    games.all.matches.stats = {
        matches: 0,
        fullmatches: 0,
        played: 0,
    }
    for (const game_mode of await game_modes_get_list()) {
        games.all.stats.logs = [
            ...games.all.stats.logs,
            ...games[game_mode].stats.logs
        ]
        games.all.matches.logs = [
            ...games.all.matches.logs,
            ...games[game_mode].matches.logs.filter(log => log.records)
        ]
        for (const [stat_name, stat_value] of Object.entries(games[game_mode].matches.stats)) {
            games.all.matches.stats[stat_name] += stat_value
        }
    }
    // sort matches and stats logs with limit
    const LIMIT = +process.env.LOGS_GAMES_LIMIT!
    for (const game_mode of await game_modes_get_list(C.ALL, C.ALL)) {
        for (const data_type of [C.STATS, C.MATCHES] as const) {
            games[game_mode][data_type].logs.sort((a, b) => (
                new Date(b.time).getTime() - new Date(a.time).getTime()
            )).slice(0, LIMIT)
        }
    }

    return games
}

export const set_games = async (uno: Uno, games: GamesStatus) => {
    games = await games_summary(games)
    const target_type = target_type_define(uno)
    await redis_manage(`${target_type}:${C.UNO}_${uno}`, 'hset', { games })

    if (target_type !== C.PLAYER) return

    await player_update(uno, { games }, set_games.name)

    // also update in groups cache
    const player_group = await redis_manage(
        `${C.PLAYER}:${C.UNO}_${uno}`, 'hget', C.GROUP
    )

    if (!player_group) return

    const players = await redis_manage(
        `${C.GROUP}:${C.UNO}_${player_group}`, 'hget', C.PLAYERS
    )
    if (players && uno in players) {
        players[uno].games = games
        await redis_manage(
            `${C.GROUP}:${C.UNO}_${player_group}`,
            'hset',
            {
                players,
                games: await group_players_games(
                    Object.values(players).map(player => player.games)
                ),
            },
        )
    } else {
        in_logs(
            uno,
            `${set_games.name} ${C.GROUP} [${player_group}] ${C.NOT_FOUND}`,
            'cod_logs_error'
        )
    }
}

export const group_players_games = async (games_list: GamesStatus[]) => {
    const GAME_STATUS: GameStatus = {
        status: GameStatusStatusSchema.enum.NOT_ENABLED,
        matches: {
            stats: {
                matches: 0,
                fullmatches: 0,
                played: 0,
            },
            logs: [],
        },
        stats: { logs: [] },
    }
    const games_all: GamesStatus = {
        all: structuredClone({ ...GAME_STATUS, status: PlayerParsedSchema.enum.MATCHES }),
        mw_mp: structuredClone(GAME_STATUS),
        mw_wz: structuredClone(GAME_STATUS),
        cw_mp: structuredClone(GAME_STATUS),
        vg_mp: structuredClone(GAME_STATUS),
    }
    for (const games of games_list) {
        if (games.all.status !== PlayerParsedSchema.enum.NONE) {
            games_all.all.status = games.all.status
        }
        for (const game_mode of await game_modes_get_list()) {
            // if player have enabled game, enable for group
            if (games[game_mode].status !== GameStatusStatusSchema.enum.DISABLED) {
                games_all[game_mode].status = GameStatusStatusSchema.enum.ENABLED
            }
            // summary matches and stats logs
            games_all[game_mode].matches.logs = [
                ...games_all[game_mode].matches.logs,
                ...games[game_mode].matches.logs
            ]
            games_all[game_mode].stats.logs = [
                ...games_all[game_mode].stats.logs,
                ...games[game_mode].stats.logs
            ]
            // summary matches stats
            for (const [name, stat] of Object.entries(games[game_mode].matches.stats)) {
                games_all[game_mode].matches.stats[name] += stat
            }
        }
    }

    return games_summary(games_all)
}

export const players_get = async (): Promise<PlayerBasic[]> => db.query.cod_players.findMany({
    columns: {
        id: true,
        uno: true,
        acti: true,
        battle: true,
        username: true,
        clantag: true,
        group: true,
        games: true,
        time: true,
    },
    // extras: ({ time }) => ({ time: sql<string>`${time}::timestamp`.as(C.ISO) }),
})

export const players_cache_update = async () => {
    const players = await db.query.cod_players.findMany()
    const players_with_group = players.filter(
        player => player.group
    ) as (typeof players[number] & { group: string })[]

    await redis_manage(`${C.PLAYER}:*`, C.DELETE)
    for (const player of players) {
        const player_data: PlayerData = {
            uno: player.uno,
            username: player.username,
            clantag: player.clantag,
            games: player.games,
            games_stats: player.games_stats,
            chart: player.chart,
            most_play_with: player.most_play_with,
            loadout: player.loadout,
            group: player.group,
        }
        await redis_manage(`${C.PLAYER}:${C.UNO}_${player.uno}`, 'hset', player_data)
        await redis_manage(`${C.PLAYER}:${C.ID}_${player.id}`, 'set', player.uno)
        await redis_manage(`${C.PLAYER}:${C.USERNAME}_${player.username[0]}`, 'set', player.uno)
        if (player.acti) {
            await redis_manage(`${C.PLAYER}:${C.ACTI}_${player.acti}`, 'set', player.uno)
        }
        if (player.battle) {
            await redis_manage(`${C.PLAYER}:${C.BATTLE}_${player.battle}`, 'set', player.uno)
        }
    }

    // summared players by tracker and all groups
    const groups: GroupData[] = [
        await tracker_stats_summary(await group_players(C.TRACKER, players)),
        await group_players(C.ALL, players_with_group),
    ]

    new Set<GroupUno>(players_with_group.map(player => player.group)).forEach(async uno => {
        const players_in_group = players_with_group.filter(player => player.group === uno)
        groups.push(await group_players(uno, players_in_group))
    })

    await redis_manage(`${C.GROUP}:*`, C.DELETE)
    for (const group of groups) {
        await redis_manage(`${C.GROUP}:${C.UNO}_${group.uno}`, 'hset', group)
    }
}

export const update_router = async (
    uno: Uno,
    game_mode: GameMode,
    data_type: UpdateRouterDataType,
) => {
    if (data_type === C.ALL) {
        const matches_message = await validate_update(uno, game_mode, C.MATCHES)
        const stats_message = await validate_update(uno, game_mode, C.STATS)
        return `${matches_message}\n${stats_message}`
    }
    return await validate_update(uno, game_mode, data_type)
}

export const validate_update = async (
    uno: Uno,
    game_mode: GameMode,
    data_type: UpdateRouterDataType
) => {
    const target_data = await target_data_get(uno)

    if (!target_data) {
        throw new Error(`[${uno}] ${C.NOT_FOUND}`)
    }

    let username = ''

    if (is_player(target_data)) {
        await validate_update_player(target_data, game_mode, data_type)
        username = target_data.username[0]
    } else if (is_group(target_data)) {
        await validate_update_group(target_data, game_mode, data_type)
        username = uno
    }

    const tracker_status = await redis_manage(C.STATUS)
    if (tracker_status !== C.ACTIVE) {
        throw new Error(`fetch ${C.DATA} ${tracker_status}`)
    }

    const task_status = await add_to_task_queues(uno, game_mode, data_type)
    const message: `[${string}] ${GameMode} ${UpdateRouterDataType} ${TaskStatusResponce}` =
        `[${username}] ${game_mode} ${data_type} ${task_status}`

    if (
        task_status === TaskStatusResponceSchema.enum.ALREADY_RUNNING ||
        task_status === TaskStatusResponceSchema.enum.IN_QUEUES
    ) {
        throw new Error(message)
    }

    return message
}

export const validate_update_group = async (
    group: GroupData,
    game_mode: GameMode,
    data_type: UpdateRouterDataType
) => {
    if (!Object.keys(group.players).length) {
        throw new Error(`${C.PLAYERS} ${C.NOT_FOUND} for ${C.GROUP} [${group.uno}]`)
    }

    if (data_type == C.MATCHES && game_mode !== C.ALL) {
        const last_log = group.games[game_mode].matches.logs[0]
        const seconds_wait = await seconds_wait_expire(
            last_log.time,
            +process.env.MATCHES_INTERVAL_MINUTES! * 60
        )
        if (seconds_wait) {
            throw new Error(`please wait [${seconds_wait}]`)
        }
    } else if (data_type === C.STATS) {
    } else if (data_type === C.MATCHES_HISTORY) {
    } else if (data_type === C.FULLMATCHES_PARS) {
    }
}

export const validate_update_player = async (
    player: PlayerData,
    game_mode: GameMode,
    data_type: UpdateRouterDataType
) => {
    const username = player.username[0]
    const player_status = player.games.all.status
    const game_status = player.games[game_mode].status

    if (data_type === C.MATCHES_HISTORY && player_status !== PlayerParsedSchema.enum.NONE) {
        throw new Error(`${C.MATCHES} [${username}] already parsed`)
    }

    if (data_type === C.FULLMATCHES_PARS) {
    } else if (game_mode === C.ALL) {
    } else if (data_type === C.MATCHES && player_status === PlayerParsedSchema.enum.NONE) {
        throw new Error(`[${username}] ${C.PLAYER} not ${C.ENABLED}`)
    } else if (game_status === GameStatusStatusSchema.enum.NOT_ENABLED) {
        throw new Error(`[${username}] ${game_mode} not ${C.ENABLED}`)
    } else if (game_status === GameStatusStatusSchema.enum.DISABLED) {
        throw new Error(`[${username}] ${game_mode} disabled`)
    } else if (data_type === C.MATCHES && game_status === GameStatusStatusSchema.enum.ENABLED) {
        const last_log = player.games[game_mode].matches.logs[0]
        const seconds_wait = await seconds_wait_expire(
            last_log.time,
            +process.env.MATCHES_INTERVAL_MINUTES! * 60
        )
        if (seconds_wait) {
            throw new Error(`please wait [${seconds_wait}]`)
        }
    } else if (data_type === C.STATS) {
        const last_log = player.games[game_mode].stats.logs[0]
        const weeks_interval = +process.env.STATS_INTERVAL_WEEKS!
        const seconds_wait = await seconds_wait_expire(
            last_log.time, weeks_interval * 24 * 60 * 60
        )
        if (seconds_wait) {
            throw new Error(`\
            please wait [${seconds_wait}]
            ${C.TIME} interval between updates ${weeks_interval} week`)
        }
    }
}

export async function game_modes_get(): Promise<GameModeMap<GameModeOnly>>
export async function game_modes_get(game: C.ALL, mode: C.ALL): Promise<GameModeMap<GameMode>>
export async function game_modes_get(game: C.MW, mode: C.ALL): Promise<GameModeMap<GameModeMw>>
export async function game_modes_get(game?: Game, mode?: Mode): Promise<GameModeMap> {
    if (game === C.ALL && mode === C.ALL) {
        return GAME_MODES
    }

    const game_modes: GameModeMap = {}

    if (!game && !mode) {
        for (const game_mode of GameModeOnlySchema.options) {
            game_modes[game_mode] = GAME_MODES[game_mode]
        }
        return game_modes
    }

    // if game_mode combination is valid
    const game_mode = game && mode ? `${game}_${mode}` : undefined
    const is_game_mode = GameModeSchema.safeParse(game_mode)
    if (is_game_mode.success) {
        const game_mode = is_game_mode.data
        return { [game_mode]: GAME_MODES[game_mode] }
    }

    // filter based on partial matches
    const game_filter = game ?? C.ALL
    const mode_filter = mode ?? C.ALL
    for (const game_mode of GameModeSchema.options) {
        const [_game, _mode] = GAME_MODES[game_mode]
        const game_matches = game_filter === C.ALL || _game === game_filter
        const mode_matches = mode_filter === C.ALL || _mode === mode_filter

        if (game_matches && mode_matches) {
            game_modes[game_mode] = GAME_MODES[game_mode]
        }
    }

    return game_modes
}

export async function game_modes_get_list(): Promise<GameModeOnly[]>
export async function game_modes_get_list(game: C.ALL, mode: C.ALL): Promise<GameMode[]>
export async function game_modes_get_list(game: C.MW, mode: C.ALL): Promise<GameModeMw[]>
export async function game_modes_get_list(game?: Game, mode?: Mode): Promise<string[]> {
    const game_modes = await game_modes_get(game as never, mode as never)
    return Object.keys(game_modes)
}

export const in_logs_cache_tracker = async (
    target: string, game_mode: GameMode, message: string
) => {
    const LIMIT = +process.env.LOGS_CACHE_LIMIT!
    const log: LogsTracker = {
        target: is_number(target) ? `[${target}]` : target,
        game_mode,
        message,
        time: new Date().toISOString()
    }
    const added_index = await redis_manage('cod_logs_cache', 'lpush', log)
    if (added_index > LIMIT + (LIMIT / 4)) { // keeping logs under limit
        redis_manage('cod_logs_cache', 'ltrim', LIMIT)
    }
}

export async function validate_data_through_fastapi_socket(data: {
    name: 'player_game_mode_access'
    value: object
}) {
    let status: boolean | undefined = undefined
    let time_passed = 0
    const socket = new Socket()

    socket.connect(
        +process.env.FASTAPI_MONITOR_PORT!,
        process.env.FASTAPI_MONITOR_HOST!,
        () => socket.write(JSON.stringify(data))
    )

    socket.on('data', async (data: Buffer) => {
        const message = data.toString()
        status = message === '1'
    })

    while (status === undefined) {
        const time_wait = 200
        await new Promise(r => setTimeout(r, time_wait))
        time_passed += time_wait
        if (time_passed > TIME_LOAD_DELAY) {
            status = false
        }
    }

    return status
}

export async function target_unos_get(target_type: C.ALL): Promise<(Uno[])>
export async function target_unos_get(target_type: C.PLAYER): Promise<(PlayerUno[])>
export async function target_unos_get(target_type: C.GROUP): Promise<(GroupUno[])>
export async function target_unos_get(target_type: TargetType | C.ALL): Promise<PlayerUno[] | GroupUno[]> {
    let targets_uid: Uno[] = []

    if (target_type === C.ALL) {
        targets_uid = [
            ...(await redis_manage(`${C.PLAYER}:${C.UNO}_*`, 'keys')),
            ...(await redis_manage(`${C.GROUP}:${C.UNO}_*`, 'keys')),
        ]
    } else {
        targets_uid = await redis_manage(`${target_type}:${C.UNO}_*`, 'keys')
    }

    const target_unos = targets_uid.map(uid => uid.split(`${C.UNO}_`, 2)[1])

    return target_unos
}

export const groups_cache_get = async (): Promise<GroupData[]> => {
    const groups: GroupData[] = []
    const target_unos = await target_unos_get(C.GROUP)
    for (const uno of target_unos) {
        const group = await redis_manage(`${C.GROUP}:${C.UNO}_${uno}`, 'hgetall')
        if (group) groups.push(group)
    }

    return groups
}

export const groups_cache_get_basic = async (): Promise<GroupBasic[]> => {
    const groups: GroupBasic[] = []
    const target_unos = await target_unos_get(C.GROUP)

    for (const uno of target_unos) {
        if (uno === C.TRACKER) continue
        const [username, clantag, games, players] = (await redis_manage(
            `${C.GROUP}:${C.UNO}_${uno}`,
            'hmget',
            [C.USERNAME, C.CLANTAG, C.GAMES, C.PLAYERS]
        )) as [string[], string[], GamesStatus, Record<string, PlayerDataBasic>]
        groups.push({
            uno,
            username,
            clantag,
            games,
            players: uno === C.ALL ? {} : players,
        })
    }
    return groups
}

export const target_data_get = async (uno: Uno) => {
    const target_type: TargetType = is_group_uno(uno) ? C.GROUP : C.PLAYER
    const target_data = await redis_manage(`${target_type}:${C.UNO}_${uno}`, 'hgetall')
    return target_data
}

export const game_stats_format = async (
    lifetime: GameStatsDataLifetime | GameStatsDataLifetimeCW,
    game: GameOnly
): Promise<GameStats> => {
    const data = GameStatsSchema.parse({
        all: lifetime.all.properties,
        scorestreak: { all: {} },
    })

    for (const [k, v] of Object.entries(lifetime.itemData)) {
        if (k === 'scorestreak') continue
        const weapons_name = k as keyof typeof lifetime.itemData
        const weapons_value = v as GameStatsDataWeaponValue
        const game_stats = data[weapons_name]
        if (!game_stats) continue
        for (const [weapon_name, weapon_value] of Object.entries(weapons_value)) {
            game_stats[weapon_name] = weapon_value.properties
        }
    }

    // delete duplicated stats
    for (const stat_name of ['gamesPlayed', 'winLossRatio', 'recordKillStreak']) {
        if (stat_name in data.all) {
            delete data.all[stat_name]
        }
    }

    if (game === C.CW) {
        lifetime = lifetime as GameStatsDataLifetimeCW

        const keys_to_rename = {
            [C.KDRATIO]: 'kdratio',
            'wlRatio': 'wlratio',
            'totalShots': 'shots',
            'longestStreak': 'longestKillstreak',
            'currentWinStreak': 'curWinStreak',
        }
        for (const [name, rename] of Object.entries(keys_to_rename)) {
            if (rename in data.all) {
                data.all[name] = data.all[rename]
                delete data.all[rename]
            }
        }

        for (const [k, v] of Object.entries(lifetime.scorestreakData.scorestreakData)) {
            data.scorestreak[k] = v.properties
        }
    } else {
        lifetime = lifetime as GameStatsDataLifetime

        data.all_additional = lifetime.accoladeData.properties
        data.all.longestStreak = data.all.bestKillStreak!
        delete data.all.bestKillStreak

        for (const [k, v] of Object.entries(lifetime.scorestreakData.lethalScorestreakData)) {
            data.scorestreak[k] = v.properties
        }
        for (const [k, v] of Object.entries(lifetime.scorestreakData.supportScorestreakData)) {
            data.scorestreak[k] = v.properties
        }
    }

    if (lifetime.attachmentData) {
        data.attachment = data.attachment ?? { all: {} }
        for (const [attachment_name, attachment_stats] of Object.entries(lifetime.attachmentData)) {
            data.attachment[attachment_name] = {}
            for (const [_, stat_value] of Object.entries(attachment_stats.properties)) {
                const stat_name = (_ === 'headShots' ? C.HEADSHOTS : _) as StatNameAttachment
                data.attachment[attachment_name][stat_name] = stat_value
            }
        }
    }

    for (const stats_name of GameStatsDataKeySchema.options) {
        if (!data[stats_name]) continue
        const summary: GameStatsData['all'] = {}
        for (const weapon_value of Object.values(data[stats_name])) {
            // summary weapon stats
            for (const [k, stat_value] of Object.entries(weapon_value!)) {
                const stat_name = k as keyof typeof summary
                summary[stat_name] = (summary[stat_name] ?? 0) + (stat_value as number)
            }
        }

        data[stats_name].all = await correct_ratio(summary)
    }

    return await format_stat_values(data)
}

async function format_stat_values<T>(stats: object) {
    const formated: Record<string, number | object> = {}

    for (const [stat_name, stat_value] of Object.entries(stats)) {
        if (!stat_value) continue

        if (typeof stat_value === 'object') {
            const formatted_object = await format_stat_values<object>(stat_value)
            if (Object.keys(formatted_object).length) {
                formated[stat_name] = formatted_object
            } else {
                continue
            }
        } else if (!Number.isInteger(stat_value)) {
            const formatted_number: number = +stat_value.toFixed(2)
            formated[stat_name] = formatted_number
        } else {
            formated[stat_name] = stat_value
        }
    }

    return await correct_ratio<T>(formated)
}

export const stats_add_summary_all_modes = async (games_stats: GamesStats) => {
    // reset summary all modes
    games_stats.all = {} as GameStats

    for (const game_stats of Object.values(games_stats)) {

        for (const stats_name of GameStatsDataKeySimpleSchema.options) {
            const game_stat = game_stats[stats_name]
            const game_stat_all = games_stats.all[stats_name]
            if (!game_stat || !game_stat_all) continue

            for (const [stat_name, stat_value] of Object.entries(game_stat)) {
                const new_value = stat_value ?? 0
                let current_value = game_stat_all[stat_name] ?? 0

                if (is_best_record(stat_name)) {
                    if (new_value > current_value) {
                        current_value = new_value // replace if better than previous
                    }
                } else {
                    current_value += new_value
                }
                game_stat_all[stat_name] = current_value
            }
            games_stats.all[stats_name] = await correct_ratio(game_stat_all)
        }

        for (const stats_name of [...GameStatsDataKeySchema.options, 'scorestreak'] as const) {
            const game_stat = game_stats[stats_name]
            const game_stat_all = games_stats.all[stats_name]
            if (!game_stat || !game_stat_all) continue

            for (const [weapon_name, weapon_value] of Object.entries(game_stat)) {
                // create weapon name if doesn't exist
                const all_weapon_stats = (game_stat_all[weapon_name] ?? {}) as Record<string, number>

                for (const [stat_name, stat_value] of Object.entries(weapon_value!)) {
                    all_weapon_stats[stat_name] = all_weapon_stats[stat_name] || 0
                    all_weapon_stats[stat_name] += stat_value
                }

                game_stat_all[weapon_name] = all_weapon_stats
            }
        }
    }

    return games_stats
}

export async function correct_ratio<T>(stats: Record<string, number | object | undefined>) {
    if (typeof stats.kills === 'number' && typeof stats.deaths === 'number') {
        stats.kdRatio = extract_ratio(stats.kills, stats.deaths)
    }
    if (typeof stats.wins === 'number' && typeof stats.losses === 'number') {
        stats.wlRatio = extract_ratio(stats.wins, stats.losses)
    }
    if (typeof stats.hits === 'number' && typeof stats.shots === 'number') {
        stats.accuracy = +(extract_ratio(stats.hits, stats.shots) * 100).toFixed(2)
    }
    if (typeof stats.scorePerGame === 'number') {
        stats.scorePerGame = +stats.scorePerGame.toFixed(2)
    }
    if (typeof stats.scorePerMinute === 'number') {
        stats.scorePerMinute = +stats.scorePerMinute.toFixed(2)
    }

    return stats as T
}

export const stats_update_player = async (uno: PlayerUno, game_mode: GameModeOnly) => {
    const games = await player_get(uno, C.GAMES, `stats_update_player ${game_mode}`)
    let games_stats = await player_get(uno, C.GAMES_STATS, `stats_update_player ${game_mode}`)

    if (!games_stats || !games) {
        throw new Error(`[${uno}] ${C.NOT_FOUND}`)
    }

    const [game] = game_mode_split(game_mode)
    const file_path = get_file_path(uno, C.STATS, C.UNO, game_mode)
    const is_exist = fs.existsSync(file_path)

    if (is_exist) {
        const lifetime: GameStatsDataLifetime | GameStatsDataLifetimeCW = JSON.parse(
            fs.readFileSync(file_path).toString()
        ).data.lifetime

        games_stats = await stats_add_summary_all_modes({
            ...games_stats,
            [game]: await game_stats_format(lifetime, game)
        })
    }

    games[game_mode].stats.logs.push({
        uno,
        game_mode,
        records: Number(is_exist),
        source: 'stats_update_player',
        time: new Date().toISOString(),
    })

    await player_update(uno, { games, games_stats }, stats_update_player.name)

    return games_stats
}

export const in_logs_game_status = async (
    uno: Uno,
    game_mode: GameModeOnly,
    data_type: DataTypeOnly,
    records: number,
) => {
    let games: GamesStatus | null

    if (is_group_uno(uno)) {
        games = await redis_manage(`${C.GROUP}:${C.UNO}_${uno}`, 'hget', C.GAMES)
    } else {
        games = await player_get(uno, C.GAMES, 'stats_update_player')
    }

    if (!games) return

    if (data_type === C.STATS && records) {
        games[game_mode].matches.stats.played = records
    }

    const logs_type = data_type === C.STATS ? C.STATS : C.MATCHES
    const logs = games[game_mode][logs_type].logs
    const last_log = logs[0]

    if (last_log.source !== C.MATCHES && await seconds_wait_expire(last_log.time, 60)) {
        logs.shift()
    }

    logs.unshift({
        uno,
        game_mode,
        source: data_type,
        records,
        time: new Date().toISOString(),
    })

    set_games(uno, games)
}

export const cache_matches_get = async (slug_router: Router) => {
    const router = RouterSchema.parse(slug_router)
    const uid: CacheMatchesUid = `${C.MATCHES}:${router.data_type}_${router.target}_${router.game_mode}`
    const key: CacheKey = `${router.order}_${router.date}_${router.page}`
    return redis_manage(uid, 'hget', key)
}

// const player_search = async (search_body: PlayerSearch) => {
//     const { platform, target, uno } = search_body

//     if (platform !== C.SEARCH && platform !== 'tracker_search') {
//         const player = await db.query.cod_players.findFirst({
//             columns: {
//                 uno: true,
//                 group: true,
//                 username: true,
//             },
//             where: eq(schema.cod_players[platform], target)
//         })
//         if (player) {
//             if (player.group) {
//                 return `[${player[C.USERNAME][0]}] ${C.ALREADY_EXIST}`
//             }
//             return player
//         }


//     }


//     // if (PlatformOnlySchema.options.includes(platform as PlatformOnly)) {
//     //     platform
//     // }

// }

export const matches_csv_insert = async (table_name: TableCsv) => {
    const table = schema[table_name]
    const file_path = `../${C.STATIC}/${C.FILES}/tables/${C.MATCHES}/${table_name}.csv`

    if (!table) {
        console.log(`Table ${table_name} ${C.NOT_FOUND}`)
        return
    }

    if (!fs.existsSync(file_path)) {
        console.log(`File ${file_path} ${C.NOT_FOUND}`)
        return
    }

    // reset table
    await db.delete(table)
    await set_table_sequence(table, 0)

    const format_match = (match_raw: Record<string, string>) => {
        const match: typeof table.$inferInsert = {
            time: new Date(match_raw.utc_timestamp),
            matchID: match_raw.matchID,
            uno: match_raw.uno,
        }
        const handled_keys = new Set([...Object.keys(match), 'utc_timestamp'])

        Object.entries(match_raw)
            .filter(([key]) => !handled_keys.has(key))
            .filter(([, value]) => value && value !== '0')
            .forEach(([_key, _value]) => {
                const value = is_number(_value) ? +_value : _value
                const key = _key as keyof typeof match
                (match as Record<typeof key, typeof match[typeof key]>)[key] = value
            })

        return match
    }

    const start_time = Date.now()
    let row_count = 0
    let batch: typeof table.$inferInsert[] = []
    const BATCH_SIZE = 1_000

    await pipeline(
        fs.createReadStream(file_path, {
            highWaterMark: 1024 * 1024 * 10, // 10MB chunks
            autoClose: true,
        }),
        csv(),
        new Transform({
            objectMode: true,
            async transform(row, _, callback) {
                try {
                    batch.push(format_match(row))

                    if (batch.length >= BATCH_SIZE) {
                        // pause stream during insert
                        this.pause()
                        await db.insert(table).values(batch).execute()
                        row_count += batch.length
                        batch = []

                        // show progress every 5 batch inserts
                        if (row_count % (BATCH_SIZE * 5) === 0) {
                            const elapsed = (Date.now() - start_time) / 1000
                            console.log(
                                `${table_name} ${C.COMPLETED} ${row_count} ${C.MATCHES}`,
                                `(${(row_count / elapsed).toFixed(2)} ${C.MATCHES}/sec)`
                            )
                        }
                        this.resume()
                    }
                    callback()
                } catch (e) {
                    callback(e as Error)
                }
            },
            async flush(callback) {
                try {
                    if (batch.length > 0) {
                        await db.insert(table).values(batch).execute()
                        row_count += batch.length
                    }

                    callback()
                } catch (e) {
                    callback(e as Error)
                }
            }
        })
    )
    const message = `\
${table_name} ${C.COMPLETED} ${row_count} ${C.MATCHES}\
${C.TIME_TAKEN}: ${(Date.now() - start_time) / 1000}s\
`
    console.log(message)
    await in_logs(matches_csv_insert.name, message, 'cod_logs')
}

export const search_uno_tags = async (
    uno: PlayerUno,
    column: C.USERNAME | C.CLANTAG
): Promise<string[]> => {
    const game_tables = await get_game_tables(C.ALL, C.ALL)
    const table_1 = game_tables[0].table
    const table_2 = game_tables[1].table

    const create_subquery = (table: typeof table_1) => db
        .selectDistinctOn([table[column]], {
            time: table.time,
            [column]: table[column],
            uno: table.uno,
        })
        .from(table)
        .where(and(
            eq(table.uno, uno),
            isNotNull(table[column]),
        ))
        .orderBy(table[column], desc(table.time))

    const all_entries = game_tables.slice(2).reduce((qb, { table }) =>
        qb.union(create_subquery(table)),
        create_subquery(table_1).union(create_subquery(table_2))
    ).as('all_entries')

    const [result] = await db
        .select({
            [column]: sql<string[] | null>`array_agg(
                ${sql.identifier(column)}::text 
                ORDER BY ${sql`all_entries.time`} DESC
            )`
        })
        .from(all_entries)

    return result[column] || []
}

export const most_common_uno_game_mode_get = async (game_mode: GameModeMw | C.ALL) => {
    const game_tables = await get_game_tables(game_mode, C.ALL)
    const table_1 = game_tables[0].table
    const table_2 = game_tables[1].table

    const create_subquery = (table: typeof table_1) => db
        .select({ uno: table.uno })
        .from(table)

    const union_query = game_tables.slice(2).reduce((qb, { table }) =>
        qb.unionAll(create_subquery(table)),
        create_subquery(table_1).unionAll(create_subquery(table_2)),
    )
    const all_entries = db.$with('all_entries').as(union_query)

    const most_common_uno_list = await db
        .with(all_entries)
        .select({
            uno: all_entries.uno,
            count: sql<number>`count(${all_entries.uno})::int`.as(C.COUNT)
        })
        .from(all_entries)
        .groupBy(all_entries.uno)
        .having(({ count }) => gt(count, 100))
        .orderBy(sql`count DESC`)
        .limit(1000)

    const most_common_uno_game_mode: MostCommonUnoData[] = []
    for (const { uno, count } of most_common_uno_list) {
        most_common_uno_game_mode.push({
            uno,
            count,
            username: await search_uno_tags(uno, C.USERNAME),
            clantag: await search_uno_tags(uno, C.CLANTAG),
        })
    }

    return most_common_uno_game_mode
}

export const most_play_with_update = async () => {
    const most_common_uno_all = await most_common_uno_game_mode_get(C.ALL)
    const TOP_LIMIT = 50
    const time = new Date().toISOString()
    const most_play_with: MostPlayWith = {
        all: most_common_uno_all
            .map(({ uno, count, username, clantag }) => ({
                uno,
                count,
                username: username[0],
                clantag: clantag[0] || '',
            }))
            .sort((a, b) => b.count - a.count) // desc order by count
            .slice(0, TOP_LIMIT * 2), // keep top limit
        mw_mp: [],
        mw_wz: [],
        time,
    }
    const uno_tags: Record<PlayerUno, { username: string, clantag: string }> = {}
    const players: Record<
        PlayerUno,
        {
            most_play_with: MostPlayWith
            fullmatches: Record<GameModeMw, number>
        }
    > = {}
    for (const { uno, username, clantag } of most_common_uno_all) {
        players[uno] = {
            most_play_with: {
                all: [],
                mw_mp: [],
                mw_wz: [],
                time,
            },
            fullmatches: {
                mw_mp: 0,
                mw_wz: 0,
            },
        }
        uno_tags[uno] = {
            username: username[0],
            clantag: clantag[0] || '',
        }
    }

    for (const game_mode of GameModeMwSchema.options) {
        const game_tables = await get_game_tables(game_mode, C.ALL)
        const table_1 = game_tables[0].table
        const table_2 = game_tables[1].table

        const create_subquery = (table: typeof table_1) => db
            .select({
                uno: table.uno,
                matchID: table.matchID,
            })
            .from(table)

        const union_query = game_tables.slice(2).reduce((qb, { table }) =>
            qb.union(create_subquery(table)),
            create_subquery(table_1).union(create_subquery(table_2))
        )
        const all_entries = db.$with('all_entries').as(union_query)

        const all_matches: Record<MatchID, PlayerUno[]> = {}
        let uno_progress = 0

        for (const { uno } of most_common_uno_all) {
            const player_matches_count: Record<PlayerUno, number> = {}
            const player_matches_list = (
                await db
                    .with(all_entries)
                    .select({ matchID: all_entries.matchID })
                    .from(all_entries)
                    .where(eq(all_entries.uno, uno))
            ).map(({ matchID }) => matchID)

            players[uno].fullmatches[game_mode] = player_matches_list.length
            most_play_with[game_mode].push({
                uno,
                count: player_matches_list.length,
                ...uno_tags[uno],
            })

            for (const matchID of player_matches_list) {

                if (!all_matches[matchID]) {
                    const match_unos = (await db
                        .with(all_entries)
                        .select({ uno: all_entries.uno })
                        .from(all_entries)
                        .where(eq(all_entries.matchID, matchID))
                    ).map(({ uno }) => uno)

                    // check on doubles in a match
                    const unic_unos = new Set(match_unos)
                    if (unic_unos.size !== match_unos.length) {
                        clear_fullmatches_doubles(matchID, game_mode)
                        all_matches[matchID] = Array.from(unic_unos)
                    } else {
                        all_matches[matchID] = match_unos
                    }
                }

                for (const match_uno of all_matches[matchID]) {
                    // count all players in a match that play with this uno
                    if (match_uno !== uno) {
                        player_matches_count[match_uno] = (player_matches_count[match_uno] || 0) + 1
                    }
                }
            }

            const player_matches_count_top = Object.entries(player_matches_count)
                .filter(([, count]) => count > 2)
                .sort((a, b) => b[1] - a[1]) // desc order by count
                .slice(0, TOP_LIMIT) // keep top limit

            for (const [match_uno, count] of player_matches_count_top) {

                if (!uno_tags[match_uno]) {
                    for (const { table } of game_tables) {
                        const [find] = await db
                            .select({
                                username: table.username,
                                clantag: table.clantag,
                            })
                            .from(table)
                            .where(and(
                                eq(table.uno, match_uno),
                                isNotNull(table.username),
                            ))
                            .limit(1)
                        if (find?.username) {
                            uno_tags[match_uno] = {
                                username: find.username,
                                clantag: find.clantag || '',
                            }
                            break
                        }
                    }
                }

                players[uno].most_play_with[game_mode].push({
                    uno: match_uno,
                    count,
                    ...uno_tags[match_uno],
                })
            }

            uno_progress++
            if (!(uno_progress % 100)) {
                const current_percent = Math.floor((uno_progress / most_common_uno_all.length) * 100)
                console.log(most_play_with_update.name, game_mode, `${current_percent}%`)
            }
        }
    }

    for (const { uno, username, clantag } of most_common_uno_all) {
        // summary player most play with game modes
        const player_most_play_with_all: Record<PlayerUno, MostPlayWithData> = {}

        for (const game_mode of GameModeMwSchema.options) {

            for (const most_play_with_game_mode of players[uno].most_play_with[game_mode]) {

                if (!player_most_play_with_all[most_play_with_game_mode.uno]) {
                    player_most_play_with_all[most_play_with_game_mode.uno] = { ...most_play_with_game_mode }
                } else {
                    player_most_play_with_all[most_play_with_game_mode.uno].count += most_play_with_game_mode.count
                }
            }
        }

        players[uno].most_play_with.all = Object.values(player_most_play_with_all)
            .sort((a, b) => b.count - a.count) // desc order by count
            .slice(0, TOP_LIMIT) // keep top limit

        const player_data = {
            username,
            clantag,
            most_play_with: players[uno].most_play_with,
        }

        const games = (
            await db.query.cod_players.findFirst({
                columns: { games: true },
                where: eq(schema.cod_players.uno, uno),
            })
        )?.games
        if (games) {
            games.mw_mp.matches.stats.fullmatches = players[uno].fullmatches.mw_mp
            games.mw_wz.matches.stats.fullmatches = players[uno].fullmatches.mw_wz
            player_update(uno, { ...player_data, games }, most_play_with_update.name)
        } else {
            const games = games_create(
                uno,
                {
                    mw_mp: {
                        status: players[uno].fullmatches.mw_mp ? 1 : 0,
                        fullmatches: players[uno].fullmatches.mw_mp,
                    },
                    mw_wz: {
                        status: players[uno].fullmatches.mw_wz ? 1 : 0,
                        fullmatches: players[uno].fullmatches.mw_wz,
                    },
                    cw_mp: {
                        status: 0,
                        fullmatches: 0,
                    },
                    vg_mp: {
                        status: 0,
                        fullmatches: 0,
                    },
                },
                most_play_with_update.name,
            )
            db.insert(schema.cod_players).values({ uno, ...player_data, games }).execute()
        }
    }

    most_play_with.mw_mp
        .sort((a, b) => b.count - a.count) // desc order by count
        .slice(0, TOP_LIMIT * 2) // keep top limit
    most_play_with.mw_wz
        .sort((a, b) => b.count - a.count) // desc order by count
        .slice(0, TOP_LIMIT * 2) // keep top limit

    return most_play_with
}

export const match_data_get = async (matchID: MatchID | null, game_mode: GameModeMw) => {
    if (!matchID) return

    const tables = await get_game_tables(game_mode, C.ALL)
    const columns_basic = MATCH_COLUMNS[game_mode].basic

    for (const t of tables) {
        const select_columns = columns_basic.reduce((select, column) => {
            select[column] = t.table[column]
            return select
        }, {} as Record<string, PgColumn>)
        const match_query = await db
            .select(select_columns)
            .from(t.table)
            .where(eq(t.table.matchID, matchID))

        if (match_query.length) {
            const players = match_query.map(player => MatchPlayerSchema.parse({
                id: player.id,
                uno: player.uno,
                username: player.username,
                clantag: player.clantag,
                result: player.result,
                stats: Object.fromEntries(
                    MatchColumnSchema.options.map(stat_name =>
                        [stat_name, player[stat_name] || 0]
                    )
                )
            }))
            return { players, table_data: t }
        }
    }
}

export const clear_fullmatches_doubles = async (matchID: MatchID, game_mode: GameModeMw) => {
    const data = await match_data_get(matchID, game_mode)

    if (!data) {
        return `[${matchID}] ${game_mode} ${C.NOT_FOUND}`
    }

    const match_unos = new Set<string>()
    const result = []
    const table = data.table_data.table

    for (const player of data.players) {
        if (match_unos.has(player.uno)) {
            result.push({
                uno: player.uno,
                id: player.id,
                username: player.username,
            })
            await db.delete(table).where(eq(table.id, player.id))
        } else {
            match_unos.add(player.uno)
        }
    }

    if (!result.length) {
        return `[${matchID}] ${game_mode} doubles ${C.NOT_FOUND}`
    }

    const message = `[${matchID}] ${game_mode} doubles ${C.DELETED} [${result.length}]`

    in_logs(
        clear_fullmatches_doubles.name,
        message,
        'cod_logs',
        { result },
    )

    return { message, result }
}
