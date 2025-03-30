'use client'

import {
    useEffect,
    useState,
    createContext,
    useContext,
    useRef,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import useAppContext from '@/app/components/AppContext'
import FormatedTime from '@/app/components/jsx/FormatedTime'
import { IconGameMode, IconUpdate } from '@/app/components/Icons'
import {
    C,
    TIME_ALERT_5,
} from '@/app/components/Consts'
import { PlayerData } from '@/app/components/zod/Player'
import { GroupData } from '@/app/components/zod/Group'
import {
    UpdateRouterSchema,
    Router,
    ROUTER,
    UpdateResponse,
    ContextMatchesStatsNavigation,
    ContextMatchesStatsNavigationSchema,
    ContextMatchesStatsNavigationDataTypeSchema,
} from '@/app/components/zod/Router'
import {
    is_group,
    is_player,
    validate_game_mode,
} from '@/app/components/UtilsValidators'
import {
    router_generate_url,
    fetch_request,
    target_data_cache_get,
    target_data_cache_mark_to_update,
    is_target_exist,
    router_generate,
} from '@/app/components/UtilsClient'
import {
    GameMode,
    GameModeSchema,
    game_mode_split,
    GAME_MODE_TITLES,
} from '@/app/components/zod/GameMode'

const MatchesStatsContext = createContext(ContextMatchesStatsNavigationSchema.parse({
    data_type: C.MATCHES,
    router: ROUTER,
    target_data: null,
}))
export const useMatchesStatsContext = () => useContext(MatchesStatsContext)

export default function NavigationWrapper({ children }: { children: React.ReactNode }) {
    const { push } = useRouter()
    const pathname = usePathname()

    const { t } = useAppContext()
    const [router, setRouter] = useState<Router>()
    const [targetData, setTargetData] = useState<PlayerData | GroupData | null>(null)
    const pathnameCache = useRef('')

    const slugs = pathname.split('/').filter(Boolean)
    const data_type = ContextMatchesStatsNavigationDataTypeSchema.parse(slugs.shift())

    const fetch_data = async () => {
        const router = router_generate(slugs)
        setRouter(router)
        const is_target_from_tracker = await is_target_exist(router.target)
        if (!is_target_from_tracker) {
            setTargetData(null)
        } else if (!targetData || targetData.uno !== router.target) {
            const target_data = await target_data_cache_get(router.target)
            setTargetData(target_data)
        }
    }

    useEffect(() => {
        if (pathnameCache.current === pathname) return
        pathnameCache.current = pathname
        fetch_data()
    }, [pathname])

    if (!router) return <div>{t(C.LOADING)}...</div>

    const { target, game, mode } = router

    const GameModeLink = ({ game_mode }: { game_mode: GameMode }) => {
        const [_game, _mode] = game_mode_split(game_mode)
        const matches_stats = data_type === C.MATCHES && targetData?.games[game_mode].matches.stats
        const btn_style = (game === C.ALL || game === _game) && (mode === C.ALL || mode === _mode) ?
            'border-blue-500 text-gray-200' : // choosen style
            'border-transparent hover:border-blue-500' // default style

        return (
            <button
                key={game_mode}
                type="button"
                className={`dropdown border-b-2 hover:text-amber-600 ${btn_style}`}
                title={`${t(`open ${data_type}`)} ${game_mode === C.ALL ? t(game_mode) : GAME_MODE_TITLES[game_mode]}`}
                onClick={() => push(router_generate_url({
                    data_type: router.data_type === C.UNO ? data_type : router.data_type,
                    target,
                    game: _game,
                    mode: _mode,
                }))}
            >
                <IconGameMode game_mode={game_mode} size={48} />
                {matches_stats && matches_stats.played > 0 && (
                    <span className="popUp -ml-12">
                        {matches_stats.matches} - {matches_stats.played}
                    </span>
                )}
            </button >
        )
    }

    const shared = ContextMatchesStatsNavigationSchema.parse({
        data_type, router, target_data: targetData
    })

    return (
        <MatchesStatsContext.Provider value={shared}>
            <title>
                {t(`\
${data_type} \
[${is_player(targetData) ? targetData.username[0] : router.target}] \
${router.game_mode === C.ALL ? '' : `${router.game} ${router.mode}`}
`)}
            </title>
            <h3 className="p-2 text-center text-2xl">
                {target === C.ALL || target === C.TRACKER ? t(target) :
                    !targetData ? target :
                        is_group(targetData) ? `${t(C.GROUP)} ${target}` :
                            targetData.username[0]}
            </h3>
            <nav className="p-4 flex flex-col items-center bg-gray-800">
                <UpdateButton shared={shared} />
                <div>
                    {(!targetData ?
                        ContextMatchesStatsNavigationDataTypeSchema.options.slice(0, 1) :
                        ContextMatchesStatsNavigationDataTypeSchema.options).map(new_path => (
                            <button
                                key={new_path}
                                type="button"
                                className="
                                p-2 text-stone-300 transition-colors hover:text-amber-600
                                disabled:hover:text-white disabled:border-blue-500
                                disabled:cursor-default disabled:border-b-2"
                                disabled={data_type === new_path}
                                onClick={() => push(router_generate_url({
                                    ...router, data_type: new_path, date: ''
                                }))}
                            >{t(new_path)}</button>
                        ))}
                </div>
                <div className="flex gap-2 justify-center">
                    {GameModeSchema.options
                        .filter(game_mode => {
                            if (game_mode === C.ALL) return true
                            if (targetData && !targetData.games[game_mode].status) {
                                return false
                            }
                            return true
                        })
                        .map(game_mode => <GameModeLink key={game_mode} game_mode={game_mode} />)}
                </div>
            </nav>
            {children}
        </MatchesStatsContext.Provider>
    )
}

const UpdateButton = ({ shared }: { shared: ContextMatchesStatsNavigation }) => {
    const { t } = useAppContext()
    const [updateButton, setUpdateButton] = useState<React.JSX.Element>()

    useEffect(() => {
        setUpdateButton(undefined)
    }, [shared])

    const { data_type, target_data, router } = shared

    if (!target_data) return null

    const is_group_ = is_group(target_data)

    const update_fetch = async () => {
        setUpdateButton(<span>{t('updating')}... </span>)
        const update_router = UpdateRouterSchema.parse({
            data_type,
            uno: target_data.uno,
            game_mode: router.game_mode,
        })
        const res = await fetch_request<UpdateResponse>('update_router', update_router)

        let alert_style = ''
        let title = ''
        let message: React.JSX.Element | string

        if (!res) {
            alert_style = 'border-red-600 text-red-600'
            title = t(C.ERROR)
            message = t(C.ERROR)
        } else if (res.seconds_wait) {
            alert_style = 'border-yellow-600 text-yellow-600'
            title = t('waiting button')
            message = <>
                {res.time && (
                    <FormatedTime
                        time={res.time}
                        title={t(`${C.TIME} check`)}
                    />
                )}
                <p>
                    {t(res.message)}: <CountDownTimer
                        seconds_wait={res.seconds_wait}
                        expire_func={() => setUpdateButton(undefined)}
                    />
                </p>
            </>
        } else if (res.detail) {
            alert_style = 'border-red-600 text-red-600'
            title = t(C.ERROR)
            message = t(res.detail)
        } else if (res.message) {
            alert_style = 'border-green-600 text-green-600'
            title = t(C.MESSAGE)
            message = t(res.message)
            target_data_cache_mark_to_update(target_data.uno)
        } else {
            alert_style = 'border-gray-600 text-gray-600'
            title = t('unknown')
            message = JSON.stringify(res)
        }

        setUpdateButton(
            <div
                className={`border-b ${alert_style}`}
                role="alert"
            >
                <p className="font-bold text-center">{title}</p>
                <div className="p-1">{message}</div>
            </div>
        )
        await new Promise(r => setTimeout(r, TIME_ALERT_5))
        setUpdateButton(undefined)
    }

    const UpdateStatus = () => {
        let game_mode: GameMode

        try {
            game_mode = validate_game_mode(`${router.game}_${router.mode}`)
        } catch {
            return null
        }

        return (
            <table className="popUp table_logs">
                <thead>
                    <tr>
                        {router.game_mode === C.ALL && <th>{t(C.GAME)}</th>}
                        <th>{t('records')}</th>
                        <th>{t(C.SOURCE)}</th>
                        {is_group_ && <th>{t(C.USERNAME)}</th>}
                        <th>{t(C.TIME)}</th>
                    </tr>
                </thead>
                <tbody>
                    {target_data.games[game_mode][data_type].logs.map(({ uno, game_mode, records, source, time }, index) => (
                        <tr key={`${game_mode}_${time}_${index}`}>
                            {router.game_mode === C.ALL && <th><IconGameMode game_mode={game_mode} size={28} /></th>}
                            <th>{records && <span className="text-green-500">+{records}</span>}</th>
                            <th>{source}</th>
                            {is_group_ && <th>{target_data.players[uno] ? target_data.players[uno].username[0] : uno}</th>}
                            <th><FormatedTime time={time} /></th>
                        </tr>
                    ))}
                </tbody>
            </table>
        )
    }

    return updateButton || (
        <button
            type="button"
            className="dropdown link text-white"
            onClick={update_fetch}
        >
            <IconUpdate />
            <UpdateStatus />
        </button>
    )
}

const CountDownTimer = ({ seconds_wait, expire_func }: {
    seconds_wait: number
    expire_func: () => void
}) => {
    const [secondsLeft, setSecondsLeft] = useState(seconds_wait)

    useEffect(() => {
        const timer = setInterval(() => {
            setSecondsLeft(prev => prev - 1)
        }, 1000)

        if (secondsLeft < 1) clearInterval(timer)
        return () => clearInterval(timer)
    }, [secondsLeft])

    if (secondsLeft < 1) {
        expire_func()
        return null
    }

    const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, '0')
    const seconds = (secondsLeft % 60).toString().padStart(2, '0')

    return (
        <span className="underline">
            <span className="text-white">{minutes}:</span>
            <span className={`
            ${secondsLeft % 2 ? 'text-emerald-500' : 'text-white'}
            transition duration-75 ease-in-out`}
            >{seconds}</span>
        </span>
    )
}
