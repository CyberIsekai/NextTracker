'use client'

import {
    useEffect,
    useState,
    useMemo,
    useOptimistic,
    useTransition
} from 'react'
import useAppContext from '@/app/components/AppContext'
import MatchStatsProgress from '@/app/components/jsx/MatchStatsProgress'
import FormatedTime from '@/app/components/jsx/FormatedTime'
import {
    IconClipBoard,
    IconGameMode,
    IconSave
} from '@/app/components/Icons'
import {
    is_game_mode,
} from '@/app/components/UtilsValidators'
import {
    C,
    TIME_ALERT_2,
} from '@/app/components/Consts'
import {
    player_clear_match_doubles,
    player_delete,
    player_edit_game_status,
    player_edit_games,
    player_edit_group,
    player_matches_delete,
    player_matches_history_pars,
} from './PlayerManage'
import {
    players_get,
    update_router,
    player_matches_stats_update,
    game_stats_get,
    player_update,
} from '@/app/components/UtilsTracker'
import {
    clipboard,
    get_percent,
    order_change,
    order_status,
} from '@/app/components/UtilsClient'
import {
    GamesStatus,
    GameStatusSchema,
    GameStatusAllSchema,
    GameStatusStatusSchema,
    PlayerParsedSchema,
} from '@/app/components/zod/GameStatus'
import {
    PlayerBasic,
} from '@/app/components/zod/Player'
import {
    UpdateRouterDataType,
} from '@/app/components/zod/Router'
import {
    GAME_MODE_TITLES,
    GameMode,
    GameModeOnly,
    GameModeSchema,
} from '@/app/components/zod/GameMode'
import {
    PlatformOnlySchema,
} from '@/app/components/zod/Main'
import {
    PlayerUno,
} from '@/app/components/zod/Uno'

const STATUS_COLOR = {
    0: 'text-gray-500',
    1: 'text-blue-400',
    2: 'text-yellow-500',
    3: 'text-green-500',
    4: 'text-red-600',
}
const COLUMNS = [
    C.ID, C.GROUP, C.USERNAME, C.CLANTAG,
    ...PlatformOnlySchema.options,
    ...GameModeSchema.options,
    C.TIME, C.DELETE
] as const

export default function Players() {
    const { t } = useAppContext()
    const [players, setPlayers] = useState<PlayerBasic[]>([])
    const [order, setOrder] = useState(order_status<Exclude<typeof COLUMNS[number], C.DELETE>>(C.ID))
    const [error, setError] = useState('')

    useEffect(() => {
        fetch_data()
    }, [])

    const fetch_data = async () => {
        try {
            const players = await players_get()
            if (players.length) {
                setPlayers(players.sort((a, b) => a.id - b.id))
                setOrder(order_status<typeof order.column>(C.ID))
                setError('')
            } else {
                setError(`${C.PLAYERS} ${C.NOT_FOUND}`)
            }
        } catch {
            setError(t(C.ERROR))
        }
    }

    const players_order = (set_order: typeof order.column) => {
        const { new_order, is_desc } = order_change<typeof order.column>(order.current, set_order)
        setOrder(order_status<typeof order.column>(new_order))
        setPlayers(prev => [...prev.sort((a, b) => {
            let a_count: string | number | null | undefined = null
            let b_count: string | number | null | undefined = null

            if (set_order === C.USERNAME || set_order === C.CLANTAG) {
                a_count = a[set_order][0]
                b_count = b[set_order][0]
            } else if (
                set_order === C.ID || set_order === C.GROUP ||
                set_order === C.ACTI || set_order === C.BATTLE
            ) {
                a_count = a[set_order]
                b_count = b[set_order]
            } else if (set_order === C.UNO) {
                a_count = +a[set_order]
                b_count = +b[set_order]
            } else if (set_order === C.TIME) {
                a_count = new Date(a.time).getTime()
                b_count = new Date(b.time).getTime()
            } else if (is_game_mode(set_order)) {
                a_count = a.games[set_order].status
                b_count = b.games[set_order].status
            }

            if (a_count === null || a_count === undefined) return 1
            if (b_count === null || b_count === undefined) return -1

            if (is_desc) {
                [a_count, b_count] = [b_count, a_count]
            }

            if (typeof a_count === 'string' && typeof b_count === 'string') {
                return a_count.localeCompare(b_count)
            }
            if (typeof a_count === 'number' && typeof b_count === 'number') {
                return a_count - b_count
            }
            return 0
        })])
    }

    const players_filter = (uno: PlayerUno) => {
        setPlayers(prev => {
            const players_filtered = prev.filter(player => player.uno !== uno)
            if (!players_filtered.length) setError(`no ${C.PLAYERS}`)
            return players_filtered
        })
    }

    const PlayersTable = useMemo(() => (
        <table className="table_logs">
            <thead className="sticky-top top-2">
                <tr>
                    {COLUMNS.map(column => {
                        const is_asc = order.column === column && !order.is_desc
                        const is_desc = order.column === column && order.is_desc
                        const is_delete = column === C.DELETE
                        return (
                            <th key={column}>
                                <button
                                    type='button'
                                    className="inline-flex hover:text-blue-300"
                                    onClick={() => !is_delete && players_order(column)}
                                    disabled={is_delete}
                                >
                                    {is_game_mode(column) ? (
                                        <IconGameMode game_mode={column} />
                                    ) : (
                                        t(column)
                                    )}
                                    <span> {is_desc ? '↓' : is_asc ? '↑' : ''}</span>
                                </button>
                            </th>
                        )
                    })}
                </tr>
            </thead>
            <tbody>
                {players.map(player =>
                    <PlayerRow
                        key={player.uno}
                        player_data={player}
                        players_filter={players_filter}
                    />)}
            </tbody>
        </table>
    ), [players])

    return <>
        <title>{t(C.PLAYERS)}</title>
        <div className="p-4 text-center">
            <button
                type='button'
                className="link"
                onClick={fetch_data}
            >{t(C.REFRESH)}</button>
        </div>
        {error ? error : !players.length ? `${t(C.LOADING)}...` : PlayersTable}
    </>
}

const ShowGamesStatus = ({ uno, game_mode, games_status }: {
    uno: PlayerUno
    game_mode: GameMode
    games_status: GamesStatus
}) => {
    const { t } = useAppContext()
    const [status, setStatus] = useState<React.JSX.Element | null>(null)

    const change_stat = async (form_data: FormData) => {
        const game_status = JSON.parse(form_data.get(C.STATS)?.toString().trim() || '')
        try {
            if (game_mode === C.ALL) {
                games_status[game_mode] = GameStatusAllSchema.parse(game_status)
            } else {
                games_status[game_mode] = GameStatusSchema.parse(game_status)
            }
            await player_edit_games(uno, games_status)
            setStatus(
                <div className="message-success">
                    {t('saved')}
                </div>
            )
        } catch (e) {
            setStatus(
                <div className="message-error">
                    {t(`${C.VALUE} ${C.NOT_VALID}`)}
                    {(e as Error).message}
                </div>
            )
        }
    }

    return (
        <div className="flex flex-col">
            <h3 className="basic-title dropdown text-3xl text-center">
                {game_mode === C.ALL ? t(game_mode) : GAME_MODE_TITLES[game_mode]} | {t(`${C.GAME} ${C.STATUS}`)}
                <span className="popUp">{uno}</span>
            </h3>
            <form action={change_stat} className="flex flex-col items-center">
                <textarea
                    name={C.STATS}
                    className="p-4 mt-4 rounded bg-gray-800 text-white"
                    placeholder={t(`${C.PLAYER} ${C.VALUE}`)}
                    defaultValue={JSON.stringify(games_status[game_mode], null, 4)}
                    rows={8}
                    cols={80}
                    required
                />
                {status}
                <button
                    type="submit"
                    className="p-2"
                    title={t('save')}
                ><IconSave /></button>
            </ form>
        </div>
    )
}

const PlayerRow = ({ player_data, players_filter }: {
    player_data: PlayerBasic
    players_filter: (uno: PlayerUno) => void
}) => {
    const { t, modal_open } = useAppContext()
    const [, startTransition] = useTransition()

    const [error, setError] = useState<{ column: typeof COLUMNS[number], error_message?: string }>()
    const [player, setPlayer] = useState(player_data)
    const [optimistic, setOptimistic] = useOptimistic<
        { player: PlayerBasic, pending: boolean }, PlayerBasic
    >(
        { player, pending: false },
        (state, player: PlayerBasic) => ({
            ...state,
            player,
            pending: true
        })
    )

    const uno = optimistic.player.uno

    const alert_column_error = async (column: typeof COLUMNS[number], error_message?: string) => {
        setError({ column, error_message })
        await new Promise(r => setTimeout(r, TIME_ALERT_2))
        setError(undefined)
    }

    const PlayerDelete = () => {
        const [showForm, setShowForm] = useState(false)

        if (!showForm) {
            return (
                <button
                    type="button"
                    className="text-red-500"
                    title={`${t(C.DELETE)} ${C.PLAYER} [${optimistic.player.username[0]}] ?`}
                    onClick={() => setShowForm(true)}
                >✘</button>
            )
        }

        const submit = async (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault()
            setShowForm(false)

            if (!new FormData(e.target as HTMLFormElement).get(C.DELETE)) return

            try {
                await player_delete(uno)
                players_filter(uno)
            } catch {
                alert_column_error(C.DELETE)
            }
        }

        return (
            <form onSubmit={submit}>
                <input
                    type="checkbox"
                    name={C.DELETE}
                    title={t(`confirm ${C.DELETE}`)}
                />
                <button type="submit" className="ml-2">✔</button>
            </form >
        )
    }

    const PlayerGameMode = ({ game_mode }: { game_mode: GameMode }) => {
        const [status, setStatus] = useState<React.JSX.Element>()

        if (status) return status

        const game_status = optimistic.player.games[game_mode].status
        const matches_stats = optimistic.player.games[game_mode].matches.stats
        const completed_matches = get_percent(matches_stats.matches, matches_stats.played)
        const completed_fullmatches = get_percent(matches_stats.fullmatches, matches_stats.matches)

        const alert_message = async (message: string | React.JSX.Element, status: 'success' | C.ERROR) => {
            setStatus(
                <div className={status === 'success' ? 'message-success' : 'message-error'}>
                    {typeof message === 'string' ? t(message) : message}
                </div>
            )
            await new Promise(r => setTimeout(r, TIME_ALERT_2))
            setStatus(undefined)
        }

        const submit_game_status = () => startTransition(async () => {
            const current_status = player.games[game_mode].status
            player.games[game_mode].status = PlayerParsedSchema.parse(
                current_status === 3 ? 0 : current_status + 1
            )
            setOptimistic({ ...player })
            try {
                const games = await player_edit_game_status(uno, game_mode)
                setPlayer(prev => ({ ...prev, games }))
            } catch {
                alert_column_error(game_mode)
            }
        })

        const start_bg_pars = async () => {
            setStatus(<span>{t(`pars ${C.ALL} ${C.MATCHES} started`)}</span>)

            // const res = await fetch_request<PlayerMatchesHistoryPars>(
            //     `player_matches_history_pars/${uno}`
            // )
            // if (typeof res?.message === 'string') {
            //     alert_message(res.message, 'success')
            // } else {
            //     alert_message(res?.detail || `background pars ${C.MATCHES} ${C.ERROR}`, C.ERROR)
            // }

            try {
                const res = await player_matches_history_pars(uno)
                alert_message(
                    <div className="text-xs">
                        <h3 className="basic-title message-success">{t(res.message)}</h3>
                        {res.task_queues_statuses.map(status => (
                            <p key={status}>{t(status)}</p>
                        ))}
                    </div>,
                    'success'
                )
            } catch {
                alert_message(`background pars ${C.MATCHES} ${C.ERROR}`, C.ERROR)
            }
        }

        const show_game_stats = async () => {
            // const [game] = game_mode_split(game_mode)
            // const body: StatsRouter = {uno, game}
            // const res = await fetch_request<PlayerGameStats1[GameMode]>('stats_router', body)
            // if (!res || res.detail) {
            //     alert_message(res?.detail || C.ERROR, C.ERROR)
            //     return
            // }
            // game_stats = res
            try {
                const game_stats = (await game_stats_get(uno, game_mode))!
                const default_value = JSON.stringify(game_stats, null, 4)
                modal_open(
                    <div className="flex flex-col">
                        <h3 className="basic-title dropdown text-3xl text-center">
                            {title} | {t(C.STATS)}
                            <span className="popUp">{uno}</span>
                        </h3>
                        <div>
                            <textarea
                                className="p-4 mt-4 rounded bg-gray-800 text-white"
                                placeholder={t(`${C.PLAYER} ${C.VALUE}`)}
                                defaultValue={default_value}
                                rows={8}
                                cols={80}
                                readOnly
                            />
                            <div className="flex items-center">
                                <div className="m-auto">{status}</div>
                                <div className="p-2 flex gap-4 ml-auto">
                                    <button
                                        type="button"
                                        title={t('copy')}
                                        onClick={() => clipboard(default_value)}
                                    ><IconClipBoard /></button>
                                </div>
                            </div>
                        </ div>
                    </div>)
            } catch (e) {
                alert_message((e as Error).message, C.ERROR)
                return
            }
        }

        const update_matches = async (data_type: UpdateRouterDataType) => {
            setStatus(<span>{t(`update ${C.MATCHES} ${data_type} started`)}</span>)

            // const update_router: UpdateRouter = {data_type, uno, game_mode}
            // const res = await fetch_request<Message>('update_router', update_router)

            // if (typeof res?.message === 'string') {
            //     alert_message(res.message, 'success')
            // } else {
            //     alert_message(res?.detail || `update ${data_type} ${C.ERROR}`, C.ERROR)
            // }

            try {
                const message = await update_router(uno, game_mode, data_type)
                alert_message(message, 'success')
            } catch (e) {
                alert_message((e as Error).message, C.ERROR)
            }
        }

        const submit_update_matches_stats = async () => {
            setStatus(<span>{t(`update ${C.MATCHES} ${C.STATS} started`)}</span>)
            // const body: TargetGameMode = { target: uno, game_mode }
            // const res = await fetch_request<MatchesStats>('player_matches_stats_update', body)

            // if (!res || res.detail) {
            //     alert_message(res?.detail || `update ${C.MATCHES} ${C.STATS} ${C.ERROR}`, C.ERROR)
            // } else {
            //     setPlayer(prev => ({
            //         ...prev,
            //         games: {
            //             ...prev.games,
            //             [game_mode]: {
            //                 ...prev.games[game_mode],
            //                 matches_stats: res,
            //             }
            //         }
            //     }))
            // }

            try {
                const games = await player_matches_stats_update(uno, game_mode)
                setPlayer(prev => ({ ...prev, games }))
            } catch {
                alert_message(`update ${C.MATCHES} ${C.STATS} ${C.ERROR}`, C.ERROR)
            }
        }

        const submit_player_clear_match_doubles = async () => {
            setStatus(<span>{t(`clear ${C.MATCH} doubles started`)}</span>)

            // const body: TargetGameMode = { target: uno, game_mode }
            // const res = await fetch_request<Message>('player_clear_match_doubles', body)
            // if (typeof res?.message === 'string') {
            //     alert_message(res.message, 'success')
            // } else {
            //     alert_message(`clear doubles ${C.ERROR}`, C.ERROR)
            // }

            try {
                const message = await player_clear_match_doubles(uno, game_mode)
                alert_message(message, 'success')
            } catch {
                alert_message(`clear doubles ${C.ERROR}`, C.ERROR)
            }
        }

        const submit_player_matches_delete = async () => {
            setStatus(<span>{t(`${C.MATCHES} ${C.DELETE} started`)}</span>)

            optimistic.player.games[game_mode].matches.stats.matches = 0
            setOptimistic({ ...optimistic.player })

            // const body: TargetGameMode = { target: uno, game_mode }
            // const res = await fetch_request<PlayerMatchesDeleteResponse>('player_matches_delete', body)
            // if (!res || res.detail) {
            //     alert_message(res?.detail || C.ERROR, C.ERROR)
            // } else {
            //     alert_message(res.message, 'success')
            //     setPlayer(prev => ({
            //         ...prev,
            //         games: {
            //             ...prev.games,
            //             [game_mode]: {
            //                 ...prev.games[game_mode],
            //                 matches_stats: {
            //                     ...prev.games[game_mode].matches_stats,
            //                     matches: 0,
            //                 }
            //             }
            //         }
            //     }))
            // }

            try {
                const result = await player_matches_delete(uno, game_mode)

                for (const [_, game_mode_matches_deleted] of Object.entries(result)) {
                    const game_mode = _ as GameModeOnly
                    if (game_mode_matches_deleted) {
                        player.games[game_mode].matches.stats.matches = 0
                    }
                }
                const matches_deleted = Object.values(result)
                    .reduce((matches_deleted, game_mode_matches_deleted) => (
                        matches_deleted + game_mode_matches_deleted
                    ), 0)
                setPlayer({ ...player })
                alert_message(`[${matches_deleted}] ${game_mode} ${C.MATCHES} ${C.DELETED}`, 'success')
            } catch {
                alert_message(`${C.MATCHES} ${C.DELETE} ${C.ERROR}`, C.ERROR)
            }
        }

        const title = game_mode === C.ALL ? t(game_mode) : GAME_MODE_TITLES[game_mode]

        return <>
            <div className="dropdown flex justify-center">
                <button
                    type="button"
                    className={`link disabled:opacity-70 ${game_mode === C.ALL ? STATUS_COLOR[game_status] : ''}`}
                    title={t(`change ${C.GAME} ${C.STATUS} ?`)}
                    onClick={submit_game_status}
                    disabled={optimistic.pending}
                >{game_status}</button>

                {game_mode === C.ALL && game_status === PlayerParsedSchema.enum.NONE && (
                    <button
                        type="button"
                        onClick={start_bg_pars}
                        className="ml-1 link text-amber-500"
                        title={t(`pars ${C.ALL} ${C.MATCHES}`)}
                    > {t('bg_pars')}</button>
                )}

                <div className="popUp flex flex-col">
                    <p className="text-center">{title}</p>

                    <MatchStatsProgress matches_stats={matches_stats} />

                    <button
                        type="button"
                        className="link"
                        title={t(`show ${C.STATS}`)}
                        onClick={show_game_stats}
                    >{t(`show ${C.STATS}`)}</button>

                    <button
                        type="button"
                        className="link"
                        title={t(`show ${C.GAME} ${C.STATUS}`)}
                        onClick={() => modal_open(
                            <ShowGamesStatus
                                uno={uno}
                                game_mode={game_mode}
                                games_status={optimistic.player.games}
                            />
                        )}
                    >{t(`show ${C.GAME} ${C.STATUS}`)}</button>

                    {optimistic.player.games.all.status === PlayerParsedSchema.enum.NONE &&
                        optimistic.player.games[game_mode].status > GameStatusStatusSchema.enum.NOT_ENABLED && (
                            <button
                                type="button"
                                className={`
                            flex flex-col
                            ${completed_fullmatches > 95 ? 'text-green-500' : 'text-gray-400'}
                            hover:text-cyan-400`}
                                title={t(`pars ${C.MATCHES_HISTORY}`)}
                                onClick={() => update_matches(C.MATCHES_HISTORY)}
                            >[{t(`pars ${C.MATCHES_HISTORY}`)}] {completed_matches}%</button>
                        )}

                    {[C.MW_MP, C.MW_WZ].includes(game_mode) && (
                        <button
                            type="button"
                            className={`
                                flex flex-col
                                ${completed_fullmatches > 95 ? 'text-green-500' : 'text-gray-400'}
                                hover:text-cyan-400`}
                            title={t(`start pars ${C.FULLMATCHES}`)}
                            onClick={() => update_matches(C.FULLMATCHES_PARS)}
                        >[{t(`pars ${C.FULLMATCHES}`)}] {completed_fullmatches}%</button>
                    )}

                    <button
                        type="button"
                        className="link text-amber-500"
                        title={t(`update ${C.PLAYER} ${C.MATCHES} ${C.STATS}`)}
                        onClick={submit_update_matches_stats}
                    >{t(`update ${C.STATS}`)}</button>

                    <button
                        type="button"
                        className="link text-amber-500"
                        title={t(`clear ${C.PLAYER} ${C.MATCH} doubles`)}
                        onClick={submit_player_clear_match_doubles}
                    >{t(`clear ${C.MATCH} doubles`)}</button>

                    <button
                        type="button"
                        className="link text-amber-500"
                        title={t(`${C.DELETE} ${C.PLAYER} ${C.MATCHES}`)}
                        onClick={submit_player_matches_delete}
                    >{t(`${C.DELETE} ${C.MATCHES}`)}</button>
                </div>
            </div>
        </>
    }

    const PlayerGroup = () => {
        const [showForm, setShowForm] = useState(false)

        if (!showForm) {
            return (
                <button
                    type="button"
                    className="text-stone-400 hover:text-white"
                    title={t(`change ${C.GROUP}`)}
                    onClick={() => setShowForm(true)}
                >
                    {optimistic.player.group || <span className="text-sm">+</span>}
                </button>
            )
        }

        const submit_group = async (form_data: FormData) => {
            const group = form_data.get(C.GROUP)?.toString().trim() || null

            if (group === optimistic.player.group) {
                setShowForm(false)
                return
            }

            setOptimistic({ ...player, group })

            // const body: EditTarget = { target: uno, name: C.GROUP, value: group }
            // const res = await fetch_request<EditTargetResponse>('players', body, RequestMethodSchema.enum.PUT)
            // if (typeof res?.result === 'string') {
            //     setPlayer(prev => ({ ...prev, group: res.result }))
            // } else {
            //     alert_column_error(C.GROUP)
            // }

            try {
                await player_edit_group(uno, group)
                setPlayer(prev => ({ ...prev, group }))
            } catch (e) {
                alert_column_error(C.GROUP, (e as Error).message)
            }
        }

        return (
            <form action={submit_group}>
                <input
                    type="text"
                    name={C.GROUP}
                    className="px-1 text-black w-28 "
                    title={t(`change ${C.GROUP} ${C.NAME}`)}
                    placeholder={t(C.GROUP)}
                    defaultValue={optimistic.player.group || undefined}
                    autoFocus
                />
                <button type="submit" className="ml-2">✔</button>
            </form >
        )
    }

    const PlayerTime = () => {
        const [showForm, setShowForm] = useState(false)

        const time = optimistic.player.time.toISOString()
        const initial_time = time.substring(0, 16)

        if (!showForm) {
            return (
                <button
                    type="button"
                    className="text-stone-400 hover:text-white"
                    title={t(`change register ${C.TIME} ?`)}
                    onClick={() => setShowForm(true)}
                ><FormatedTime time={time} /></button>
            )
        }

        const submit_time = async (form_data: FormData) => {
            const input_time = form_data.get(C.TIME)?.toString().trim() || null

            if (!input_time || initial_time === input_time) {
                setShowForm(false)
                return
            }
            const time = new Date(input_time)

            setOptimistic({ ...player, time })

            // const body: EditTarget = {
            //     target: uno, name: C.TIME, value: date_epoch(new Date(time))
            // }
            // const res = await fetch_request<EditTargetResponse>('players', body, RequestMethodSchema.enum.PUT)
            // if (typeof res?.result === 'string') {
            //     setPlayer(prev => ({ ...prev, time: res.result }))
            // } else {
            //     alert_column_error(C.TIME, res?.detail)
            // }

            try {
                await player_update(uno, { time }, `panel ${PlayerTime.name}`)
                setPlayer(prev => ({ ...prev, time }))
            } catch {
                alert_column_error(C.TIME)
            }
        }

        return (
            <form className="text-center" action={submit_time}>
                <label className="flex flex-col gap-2">
                    {t(`choose ${C.TIME}`)}
                    <input
                        type="datetime-local"
                        name={C.TIME}
                        className="p-2 bg-gray-800"
                        defaultValue={initial_time}
                    />
                </label>
                <button type="submit" className="p-1 flex m-auto">✔</button>
            </form >
        )
    }

    return (
        <tr>
            {COLUMNS.map(column => {
                let column_value: React.JSX.Element

                if (column === error?.column) {
                    column_value = (
                        <span className="message-error">
                            {t(error.error_message || `change ${column} ${C.ERROR}`)}
                        </span>
                    )
                } else if (column === C.ID) {
                    column_value = <span className="text-center">{optimistic.player.id}</span>
                } else if (column === C.GROUP) {
                    column_value = <span className="text-center"><PlayerGroup /></span>
                } else if (column === C.USERNAME || column === C.CLANTAG) {
                    column_value = (
                        <span className="dropdown">
                            {optimistic.player[column][0]}
                            {optimistic.player[column].length > 1 && (
                                <span className="popUp max-w-[20rem] break-words">
                                    {optimistic.player[column].join(', ')}
                                </span>
                            )}
                        </span>
                    )
                } else if (column === C.UNO || column === C.ACTI || column === C.BATTLE) {
                    column_value = <span>{optimistic.player[column]}</span>
                } else if (column === C.TIME) {
                    column_value = <PlayerTime />
                } else if (column === C.DELETE) {
                    column_value = <span className="flex justify-center gap-1"><PlayerDelete /></span>
                } else if (is_game_mode(column)) {
                    column_value = <PlayerGameMode key={`${uno}_${column}`} game_mode={column} />
                } else {
                    return
                }

                return (
                    <td key={`${optimistic.player.uno}_${column}`}>
                        {column_value}
                    </td>
                )
            })}
        </tr>
    )
}
