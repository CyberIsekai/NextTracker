'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import useAppContext from '@/app/components/AppContext'
import FormatedTime from '@/app/components/jsx/FormatedTime'
import { UserStatus } from '@/app/components/UserManager'
import { IconGameMode, IconAnimatedSpin } from '@/app/components/Icons'
import {
    C,
    TIME_LOAD_DELAY,
} from '@/app/components/Consts'
import {
    groups_cache_get_basic,
} from '@/app/components/UtilsTracker'
import {
    logs_cache_get
} from '@/app/components/UtilsBase'
import {
    date_format,
    get_ago_seconds,
    router_generate_url,
    get_ago,
    router_generate,
} from '@/app/components/UtilsClient'
import {
    GroupBasic,
} from '@/app/components/zod/Group'
import {
    GroupUno,
} from '@/app/components/zod/Uno'
import { UsersPage } from '@/app/components/zod/User'
import {
    GameMode,
    GameModeSchema,
    game_mode_split,
    GAME_MODE_TITLES,
} from '@/app/components/zod/GameMode'
import { LogsTracker } from '@/app/components/zod/Logs'
import {
    PlayerDataBasic,
} from '@/app/components/zod/Player'
import {
    GameStatusLog,
    GameStatusStatusSchema,
    PlayerParsedSchema,
} from '@/app/components/zod/GameStatus'

// ${leftPanel ? 'm-4xl:pl-64' : ''}

export default function Layout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const { t, profile, modal_open } = useAppContext()

    const [leftPanel, setLeftPanel] = useState(false)

    const Page = ({ page }: { page: UsersPage }) => {
        const { name, path, sub_pages } = page

        const sub_links = sub_pages.map(sub_page => {
            const url = `${path}/${sub_page}`
            const color = pathname === url ? 'text-white bg-gray-900' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            return (
                <li key={url}>
                    <Link
                        href={url}
                        className={`p-1 mt-1 peer block whitespace-no-wrap font-medium text-sm rounded-md ${color}`}
                        title={t(`open ${sub_page} ?`)}
                    >{t(sub_page)}</Link>
                </li>
            )
        })

        return (
            <li>
                <Link
                    className={`
                    p-2 peer font-medium text-sm rounded-md
                    ${pathname === path ? 'text-white bg-gray-800'
                            : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                    href={path}
                >{t(name)}</Link>
                {sub_links.length > 0 && (
                    <ul
                        className="
                        p-2 absolute hidden mt-1 z-[5] rounded text-gray-700
                        bg-gray-800 focus:text-gray-300 hover:block peer-hover:block"
                    >{sub_links}</ul>
                )}
            </li>
        )
    }

    return <>
        <nav
            className="
            sticky z-[3] top-0 w-full backdrop-blur transition-colors
            duration-500 border-slate-50/[0.06] bg-transparent"
        >
            <ul className="flex gap-2 items-center mx-4 border-b border-slate-300/10">
                <li>
                    <button
                        type="button"
                        title={t(`${leftPanel ? 'close' : 'open'} ${C.PLAYERS}`)}
                        className={leftPanel ? 'hamburger active' : 'hamburger'}
                        onClick={() => setLeftPanel(prev => !prev)}
                    >
                        <span className="line" />
                        <span className="line" />
                        <span className="line" />
                    </button>
                </li>
                {profile.pages.map(page => <Page key={page.name} page={page} />)}
                <li>
                    <button
                        type="button"
                        className="mr-4 hover:underline md:mr-6"
                        title={t(`open ${C.LOGS} modal`)}
                        onClick={() => modal_open(<LogsTrackerTable />)}
                    >{t(C.LOGS)}</button>
                </li>
                <li className="ml-auto"><UserStatus /></li>
            </ul>
        </nav>

        <GroupsPanel toggled={leftPanel} />

        <main className="flex flex-col justify-center items-center">{children}</main>
        <footer
            className="
            p-2 m-2xl:hidden fixed bottom-0 right-0 w-1/5 flex items-center
            justify-end shadow bg-gradient-to-l from-gray-800"
        >
            <span className="text-sm text-gray-500 sm:text-center dark:text-gray-400">
                <Link href="/stats">{t(`${C.TRACKER} ${C.STATS}`)}</Link>
            </span>
        </footer>
    </>
}

const GroupsPanel = ({ toggled }: { toggled: boolean }) => {
    const pathname = usePathname()
    const { t } = useAppContext()

    const [groups, setGroups] = useState<GroupBasic[] | null>([])
    const [loading, setLoading] = useState(false)

    const slugs = pathname.split('/').filter(Boolean)
    const slug = slugs.shift()
    const path = slug === C.MATCHES || slug === C.STATS ? slug : null
    const data_type = path || C.MATCHES
    const router = path && router_generate(slugs)

    const fetch_data = async () => {
        if (loading) return
        setLoading(true)
        try {
            const groups = await groups_cache_get_basic()
            setGroups(groups.sort((a, b) => (
                Object.keys(a.players).length - Object.keys(b.players).length
            )))
        } catch {
            setGroups(null)
        }
        await new Promise(r => setTimeout(r, TIME_LOAD_DELAY))
        setLoading(false)
    }

    useEffect(() => {
        if (toggled && groups && !groups.length) {
            fetch_data()
        }
    }, [toggled])

    const choosen_color = data_type === C.STATS ? 'indigo' : 'blue'

    const PlayerRow = ({ group_uno, player }: { group_uno: GroupUno, player: PlayerDataBasic }) => {
        const is_choosen = router && [player.uno, group_uno, C.ALL].includes(router.target)

        const GameLink = ({ game_mode }: { game_mode: GameMode }) => {
            const [game, mode] = game_mode_split(game_mode)
            const game_status = player.games[game_mode]
            if (game_status.status === GameStatusStatusSchema.enum.NOT_ENABLED) return <td />

            const log_last = game_status.matches.logs[0]
            let log_with_records: GameStatusLog | null = null

            for (const log of game_status.matches.logs) {
                if (log.records) {
                    log_with_records = log
                    break
                }
            }

            const seconds_ago = get_ago_seconds((log_with_records || log_last).time)
            const is_new_records = seconds_ago < 86400 || player.games.all.status === PlayerParsedSchema.enum.NONE
            const is_choosen_game_mode =
                router && is_choosen &&
                [C.ALL, game].includes(router.game) &&
                [C.ALL, mode].includes(router.mode)

            return (
                <td className="dropdown">
                    <Link
                        href={router_generate_url({ data_type, target: player.uno, game, mode })}
                        className={`
                        text-center
                        ${is_choosen_game_mode ? `border-dotted border border-${choosen_color}-500` : ''}
                            w-9 hover:text-amber-600 inline-block overflow-hidden
                        ${is_new_records ? 'text-green-500'
                                : seconds_ago > 320000 ? 'text-gray-500'
                                    : 'text-green-700'}
                        `}
                    >{log_with_records ? `+${log_with_records.records}` : 0}</Link>

                    <div className="popUp popUp-left text-left text-sm">
                        <p>{game_mode === C.ALL ? t(game_mode) : GAME_MODE_TITLES[game_mode]}</p>
                        {log_with_records && (
                            <p>
                                <span>{t('added')}: {get_ago(log_with_records.time)} </span>
                                [<span className="text-green-500">{log_with_records.records}</span>]
                            </p>
                        )}
                        <FormatedTime time={log_last.time} title={t('last check')} />
                    </div>
                </td>
            )
        }

        return (
            <tr>
                <td>
                    <div
                        className={`
                        dropdown w-32 overflow-hidden
                        ${router?.game_mode === C.ALL && is_choosen ? `border-dashed border border-${choosen_color}-500` : ''}`}
                    >
                        <Link
                            href={router_generate_url({ data_type, target: player.uno })}
                            title={player.username[0]}
                            className="hover:text-amber-600"
                        >{player.username[0]}</Link>
                    </div>
                </td>
                {GameModeSchema.options
                    .filter(game_mode => game_mode !== C.ALL)
                    .map(game_mode => (
                        <GameLink key={`${player.uno}_${game_mode}`} game_mode={game_mode} />
                    ))}
            </tr>
        )
    }

    const GroupTable = ({ group }: { group: GroupBasic }) => {
        const is_choosen_group = router?.target === group.uno || router?.target === C.ALL
        const border_style = `border-${is_choosen_group ? 'dashed' : 'solid'} border-${choosen_color}-500`

        const GameTitle = ({ game_mode }: { game_mode: GameMode }) => {
            const [game, mode] = game_mode_split(game_mode)
            const is_has_games = group.games[game_mode].status
            const is_choosen_game_mode =
                router && is_has_games && is_choosen_group &&
                [C.ALL, game].includes(router.game) &&
                [C.ALL, mode].includes(router.mode)

            return (
                <th>
                    <div className={`border ${is_choosen_game_mode ? border_style : 'border-transparent'}`}>
                        {is_has_games ? (
                            <Link href={router_generate_url({ data_type, target: group.uno, game, mode })}>
                                <IconGameMode game_mode={game_mode} size={26} />
                            </Link>
                        ) : (
                            <IconGameMode game_mode={game_mode} size={26} />
                        )}
                    </div>
                </th>
            )
        }

        return <>
            <thead>
                <tr>
                    <th>
                        <div
                            className={`
                                dropdown hover:text-amber-600 w-32 overflow-hidden border
                                ${router?.game_mode === C.ALL && is_choosen_group ?
                                    border_style : 'border-transparent'}`}
                        >
                            {group.uno === C.ALL ? (
                                <Link href={router_generate_url({ data_type, target: group.uno })}>
                                    {t(C.ALL)}
                                </Link>
                            ) : <>
                                <Link href={router_generate_url({ data_type, target: group.uno })}>
                                    {group.uno}
                                </Link>
                                <span className="popUp popUp-left">
                                    {t('feed')} {Object.keys(group.players).length} {t(C.PLAYERS)}
                                </span>
                            </>}
                        </div>
                    </th>
                    {GameModeSchema.options
                        .filter(game_mode => game_mode !== C.ALL)
                        .map(game_mode => <GameTitle key={game_mode} game_mode={game_mode} />)}
                </tr>
            </thead>
            <tbody>
                {Object.values(group.players).map(player => (
                    <PlayerRow key={player.uno} group_uno={group.uno} player={player} />
                ))}
            </tbody>
        </>
    }

    const ShowGroups = () => {
        if (!groups) {
            return (
                <div className="message-error">
                    {t(`get ${C.PLAYERS} ${C.ERROR}`)}
                </div>
            )
        }

        if (!groups.length) {
            return (
                <section className="text-center">
                    {t(C.LOADING)} ... <IconAnimatedSpin />
                </section>
            )
        }

        if (groups.length < 2) {
            return (
                <section className="message-error">
                    <Link href={'/'}>
                        {t(`${C.PLAYERS} ${C.NOT_FOUND} ${C.SEARCH} and add ${C.PLAYER}`)}
                    </Link>
                </section>
            )
        }

        return (
            <section>
                <table>
                    {Object.values(groups).map(group => <GroupTable key={group.uno} group={group} />)}
                </table>
            </section>
        )
    }

    return <>
        <aside className={`left-sidebar flex flex-col gap-2 ${toggled ? 'toggled' : ''}`}>
            <section className="text-center">
                <button
                    type="button"
                    title={t(`${C.REFRESH} ${C.PLAYERS}`)}
                    className="
                    text-sm hover:text-cyan-600
                    disabled:opacity-75 disabled:cursor-not-allowed"
                    onClick={() => fetch_data()}
                    disabled={loading}
                >{t(`${C.REFRESH} ${C.PLAYERS}`)}</button>
            </section>
            <ShowGroups />
        </aside>
    </>
}

const LogsTrackerTable = () => {
    const { t, } = useAppContext()

    const [logs, setLogs] = useState<LogsTracker[]>([])
    const [tryCount, setTryCount] = useState(0)
    const [fetching, setFetching] = useState(true)
    const startIndex = useRef(0)

    const send = (message: string) => setLogs(prev => [
        {
            target: '',
            game_mode: null,
            message,
            time: new Date().toISOString()
        },
        ...prev
    ])

    const logs_get = () => {
        setFetching(true)
        setTryCount(0)
    }

    const logs_refresh = () => {
        setLogs([])
        setTryCount(0)
        setFetching(false)
        startIndex.current = 0
        send(`clean ${C.LOGS}`)
    }

    useEffect(() => {
        if (fetching && !logs.length && tryCount === 0) {
            send('connected')
        }

        const timer = setInterval(async () => {
            const new_logs = await logs_cache_get('cod_logs_cache', startIndex.current)
            if (new_logs.length) {
                setTryCount(0)
                setLogs(prev => [...new_logs, ...prev])
                startIndex.current += new_logs.length
            } else {
                setTryCount(prev => prev + 1)
            }
        }, 1000)

        const TRY_LIMIT = 3

        if (!fetching) {
            clearInterval(timer)
        } else if (tryCount > TRY_LIMIT && startIndex.current === 0) {
            send(`${C.LOGS} is empty`)
            setFetching(false)
        } else if (tryCount > TRY_LIMIT * 2) {
            send(`${C.LOGS} ${C.TIME} waiting ${C.DISABLED}`)
            setFetching(false)
        }

        return () => clearInterval(timer)
    }, [tryCount, fetching])

    const indication = [0, 3].includes(tryCount) ? '.' : [1, 4].includes(tryCount) ? '..' : '...'

    return <>
        <div className="bg-white rounded max-h-[45ch] min-w-[50rem] max-w-prose overflow-scroll">
            <table className="w-full">
                <thead className="sticky-top top-0 bg-sky-200">
                    <tr>
                        <th className="p-2">#</th>
                        <th>{t(C.TARGET)}</th>
                        <th>{t(C.GAME)}</th>
                        <th>{t(C.MESSAGE)}</th>
                        <th>{t(C.TIME)}</th>
                    </tr>
                </thead>
                <tbody>
                    {fetching && (
                        <tr className="text-gray-400/80 text-center hover:bg-yellow-50 even:bg-sky-50 odd:bg-sky-100">
                            <td /><td /><td />
                            <td>{t(`waiting new ${C.LOGS}`)}{indication}</td>
                            <td />
                        </tr>
                    )}
                    {logs.map((log, index) => (
                        <tr
                            key={log.time}
                            className={`
                                    ${log.game_mode ? '' : 'text-gray-400/80'}
                                    text-center hover:bg-yellow-50 even:bg-sky-50 odd:bg-sky-100`}
                        >
                            <td className="p-2">{logs.length - index}</td>
                            <td>{log.target}</td>
                            <td>{log.game_mode && (log.game_mode === C.ALL ? t(log.game_mode) : GAME_MODE_TITLES[log.game_mode])}</td>
                            <td>{t(log.message)}</td>
                            <td>{date_format(log.time)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        <div className="flex justify-center">
            {logs[0]?.message === `clean ${C.LOGS}` ? (
                null
            ) : (
                <button
                    type="button"
                    className="
                        py-2 px-4 float-right m-4 text-center text-white bg-blue-500
                        border-2 border-solid border-sky-800 hover:opacity-90"
                    title={t(`clean ${C.LOGS}`)}
                    onClick={logs_refresh}
                >{t(`clean ${C.LOGS}`)}</button>
            )}
            {!fetching && (
                <button
                    type="button"
                    className="
                        py-2 px-4 float-right m-4 text-center text-white bg-blue-500
                        border-2 border-solid border-sky-800 hover:opacity-90"
                    title={t(`get ${C.LOGS}`)}
                    onClick={logs_get}
                >{t(`get ${C.LOGS}`)}</button>
            )}
        </div>
    </>
}


