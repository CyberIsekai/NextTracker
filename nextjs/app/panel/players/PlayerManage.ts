'use server'

import { eq, sql } from 'drizzle-orm'
import * as schema from '@/app/components/drizzle/schema'
import redis_manage from '@/app/components/Redis'
import { db } from '@/app/components/drizzle/db'
import {
    in_logs,
    set_table_sequence,
} from '@/app/components/UtilsBase'
import { C } from '@/app/components/Consts'
import {
    add_to_task_queues,
    game_modes_get_list,
    players_cache_update,
    in_logs_cache_tracker,
    validate_data_through_fastapi_socket,
    player_get,
    player_update,
} from '@/app/components/UtilsTracker'
import {
    GamesStatus,
    GameStatusStatusSchema,
    PlayerParsedSchema,
} from '@/app/components/zod/GameStatus'
import {
    PlayerGroupSchema,
} from '@/app/components/zod/Player'
import { GameMode, GameModeOnly } from '@/app/components/zod/GameMode'
import { TaskStatusResponce } from '@/app/components/zod/Task'
import { get_game_table } from '@/app/components/Table'
import { PlayerUno } from '@/app/components/zod/Uno'
import { PlayerMatchesDeleteResponse } from '@/app/components/zod/Main'

export const player_edit_game_status = async (uno: PlayerUno, game_mode: GameMode): Promise<GamesStatus> => {
    const games = await player_get(uno, C.GAMES, `player_edit_game_status ${game_mode}`)
    if (!games) throw new Error(`[${uno}] ${C.NOT_FOUND}`)

    if (game_mode == C.ALL) {
        if (games[game_mode].status === PlayerParsedSchema.enum.NONE) {
            games[game_mode].status = PlayerParsedSchema.enum.MATCHES
        } else if (games[game_mode].status === PlayerParsedSchema.enum.MATCHES) {
            games[game_mode].status = PlayerParsedSchema.enum.FULLMATCHES
        } else if (games[game_mode].status === PlayerParsedSchema.enum.FULLMATCHES) {
            games[game_mode].status = PlayerParsedSchema.enum.ALL_AND_DISABLED
        } else if (games[game_mode].status === PlayerParsedSchema.enum.ALL_AND_DISABLED) {
            games[game_mode].status = PlayerParsedSchema.enum.NONE
        }
    } else {
        const game_status = games[game_mode]

        if (
            game_status.status === GameStatusStatusSchema.enum.NOT_ENABLED &&
            games.all.status === PlayerParsedSchema.enum.NONE
        ) {
            // check if data available for game_mode
            const value = { uno, game_mode, data_type: C.MATCHES }
            const validated = await validate_data_through_fastapi_socket({
                name: 'player_game_mode_access', value
            })

            if (validated) {
                add_to_task_queues(uno, game_mode, C.MATCHES_HISTORY)
            } else {
                game_status.status = GameStatusStatusSchema.enum.DISABLED
            }
        }

        if (game_status.status === GameStatusStatusSchema.enum.NOT_ENABLED) {
            game_status.status = GameStatusStatusSchema.enum.ENABLED
        } else if (game_status.status === GameStatusStatusSchema.enum.ENABLED) {
            game_status.status = GameStatusStatusSchema.enum.DISABLED
        } else if (game_status.status === GameStatusStatusSchema.enum.DISABLED) {
            game_status.status = GameStatusStatusSchema.enum.NOT_ENABLED
        }
    }

    await player_edit_games(uno, games)

    return games
}

export const player_edit_games = async (uno: PlayerUno, games: GamesStatus) => {
    await player_update(uno, { games })
    await redis_manage(`${C.PLAYER}:${C.UNO}_${uno}`, 'hset', { games })
}

export const player_add_game_mode = async (uno: PlayerUno, game_mode: GameMode) => {
    const [username, games] = (await redis_manage(
        `${C.PLAYER}:${C.UNO}_${uno}`, 'hmget', [C.USERNAME, C.GAMES]
    )) as [string[], GamesStatus] | [null | null]

    if (!games || !username) return `${C.PLAYER} ${C.NOT_FOUND}`

    if (games[game_mode].status !== 0) {
        return `${game_mode} [${username[0]}] already ${C.ENABLED}`
    }

    const value = { uno, game_mode, data_type: C.MATCHES }
    const validated = await validate_data_through_fastapi_socket({
        name: 'player_game_mode_access', value
    })

    if (!validated) return `${game_mode} [${username[0]}] not available`

    games[game_mode].status = GameStatusStatusSchema.enum.ENABLED
    player_edit_games(uno, games)
    add_to_task_queues(uno, game_mode, C.MATCHES_HISTORY)

    return `create ${game_mode} [${username[0]}] started`
}

export const player_delete = async (uno: PlayerUno) => {
    const [player] = await db.delete(schema.cod_players)
        .where(eq(schema.cod_players.uno, uno))
        .returning({ username: schema.cod_players.username })
    if (!player) {
        in_logs(
            uno,
            `${C.PLAYER} ${C.DELETE} ${C.NOT_FOUND}`,
            'cod_logs_player',
        )
        return
    }

    await set_table_sequence(schema.cod_players)
    await players_cache_update()
    in_logs(
        uno,
        `${C.PLAYER} ${C.DELETED} [${player.username[0]}]`,
        'cod_logs_player',
    )
}

export const player_matches_history_pars = async (uno: PlayerUno) => {
    const player = await redis_manage(`${C.PLAYER}:${C.UNO}_${uno}`, 'hgetall')

    if (!player) throw new Error(`[${uno}] ${C.NOT_FOUND}`)

    if (player.games.all.status !== PlayerParsedSchema.enum.NONE) {
        throw new Error(`${C.MATCHES} [${player.username[0]}] already parsed`)
    }

    const task_queues_statuses: `${GameModeOnly} ${TaskStatusResponce}`[] = []

    for (const game_mode of await game_modes_get_list()) {
        if (player.games[game_mode].status !== GameStatusStatusSchema.enum.ENABLED) {
            continue
        }
        const task_queues_status = await add_to_task_queues(
            uno, game_mode, C.MATCHES_HISTORY
        )
        in_logs_cache_tracker(player.username[0], game_mode, task_queues_status)
        task_queues_statuses.push(`${game_mode} ${task_queues_status}`)
    }

    return {
        message: `pars ${C.MATCHES} [${player.username[0]}] started`,
        task_queues_statuses,
    }
}

export const player_clear_match_doubles = async (uno: PlayerUno, game_mode: GameMode) => {
    if (game_mode === C.ALL) {
        let messages = ''
        for (const game_mode of await game_modes_get_list()) {
            const message = await player_clear_match_doubles(uno, game_mode)
            messages += `${message}\n`
        }
        return messages
    }

    const table = await get_game_table(game_mode, C.MATCHES)
    const matches = await db.select({ id: table.id, matchID: table.matchID })
        .from(table)
        .where(eq(table.uno, uno))

    const match_ids: string[] = []
    let doubles_found = 0

    for (const match of matches) {
        if (match_ids.includes(match.matchID)) {
            db.delete(table).where(eq(table.id, match.id))
            doubles_found++
            in_logs(
                match.matchID,
                `${game_mode} [${match.id}] double ${C.DELETED}`,
                'cod_logs',
            )
        } else {
            match_ids.push(match.matchID)
        }
    }

    const message = `${game_mode} ${C.DELETED} [${doubles_found}] doubles`

    if (doubles_found) {
        in_logs(uno, message, 'cod_logs_player')
    }

    return message
}

export const player_matches_delete = async (uno: PlayerUno, game_mode: GameMode) => {
    const result: PlayerMatchesDeleteResponse = {
        [C.MW_MP]: 0,
        [C.MW_WZ]: 0,
        [C.CW_MP]: 0,
        [C.VG_MP]: 0
    }
    const game_modes = game_mode === C.ALL ? await game_modes_get_list() : [game_mode]

    for (const game_mode of game_modes) {
        const table = await get_game_table(game_mode, C.MATCHES)
        const matches_deleted = await db
            .delete(table)
            .where(eq(table.uno, uno))
            .returning({ count: sql<number>`1` })
        result[game_mode] = matches_deleted.length
    }

    await in_logs(
        uno,
        `${player_matches_delete.name} ${game_mode}`,
        'cod_logs_player',
        result,
    )

    return result
}

export const player_edit_group = async (uno: PlayerUno, group: string | null) => {
    await player_update(uno, { group: PlayerGroupSchema.parse(group) })
    players_cache_update()
}
