'use client'

import {
    Fragment,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react'
import { useInView } from 'react-intersection-observer'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { C } from '@/app/components/Consts'
import MatchStatsCard from '@/app/components/jsx/MatchStatsCard'
import useAppContext from '@/app/components/AppContext'
import FormatedTime from '@/app/components/jsx/FormatedTime'
import { useMatchesStatsContext } from '@/app/(MatchesStats)/navigation'
import {
    IconArrowLeft,
    IconArrowRight1,
    IconGameMode,
    IconHeadshot
} from '@/app/components/Icons'
import {
    date_format,
    fetch_request,
    get_map_img,
    get_ago,
    get_result_color,
    router_generate_url,
    capitalize,
    seconds_to_duration,
    order_status,
    order_change,
} from '@/app/components/UtilsClient'
import {
    is_best_record,
} from '@/app/components/UtilsValidators'
import { extract_ratio, round_number } from '@/app/components/Utils'
import { cache_matches_get } from '@/app/components/UtilsTracker'
import {
    Router,
    RouterDate,
    RouterDateSchema,
    RouterOrder,
} from '@/app/components/zod/Router'
import {
    YearMpSchema,
    YearSchema,
} from '@/app/components/zod/Table'
import {
    DateData,
    MatchesData,
    MatchesResponse,
} from '@/app/components/zod/Matches'
import {
    GameBasicColumn,
    GameBasicColumnSchema,
    MATCH_RESULT_MP,
    MatchResultMp,
    MatchResultMpSchema,
} from '@/app/components/zod/Match'
import {
    Chart,
    MonthsSchema,
    MonthSchema,
    MonthDay,
    MonthDaySchema,
} from '@/app/components/zod/Chart'

const format_stat = (stat_name: GameBasicColumn, stat_value: number) => {
    switch (stat_name) {
        case C.TIME_PLAYED:
        case C.DURATION:
            return seconds_to_duration(stat_value)
        default:
            return stat_value
    }
}

const initial_date_data = (matches: MatchesData[]) => {
    const date_data: DateData = {
        matches: matches.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()),
        win: 0,
        loss: 0,
        draw: 0,
        stats: {
            duration: 0,
            timePlayed: 0,
            kills: 0,
            deaths: 0,
            kdRatio: 0,
            headshots: 0,
            damageDone: 0,
            longestStreak: 0,
            assists: 0,
            score: 0,
            scorePerMinute: 0
        },
        loadout: {},
        is_same_map: matches.length > 1 && matches.every(match => match.map.name === matches[0].map.name),
    }

    for (const match of date_data.matches) {
        if (match.result === 1) {
            date_data.win++
        } else if (match.game_mode !== C.MW_WZ && match.result === MatchResultMpSchema.enum.LOSS) {
            date_data.loss++
        } else {
            date_data.draw++
        }

        for (const stat_name of GameBasicColumnSchema.options) {
            if (is_best_record(stat_name)) {
                if (match[stat_name] > date_data.stats[stat_name]) {
                    date_data.stats[stat_name] = match[stat_name]
                }
            } else {
                date_data.stats[stat_name] += match[stat_name]
            }
        }

        for (const [name, uses] of Object.entries(match.loadout)) {
            date_data.loadout[name] = date_data.loadout[name] || 0
            date_data.loadout[name] += uses
        }
    }

    for (const stat_name of GameBasicColumnSchema.options) {
        const stat_value = date_data.stats[stat_name]
        if (stat_value % 1) {
            date_data.stats[stat_name] = +stat_value.toFixed(2)
        }
    }
    date_data.stats.kdRatio = extract_ratio(date_data.stats.kills, date_data.stats.deaths)

    return date_data
}

export default function MatchesTable({ slug_router }: { slug_router?: Router }) {
    const { push } = useRouter()
    const { ref, inView } = useInView()

    const { t, profile, modal_open } = useAppContext()
    const { target_data, router: context_router } = useMatchesStatsContext()

    const [error, setError] = useState('')
    const [pageData, setPageData] = useState({ found: 0, is_has_more: true })
    const dateMatches = useRef<[RouterDate, DateData][]>([])
    const summaryMatches = useRef(initial_date_data([]))

    const router = slug_router || context_router

    const load_matches = async () => {
        router.page = matches_loaded ? router.page + 1 : 1
        let res = await cache_matches_get(router)
        if (!res) {
            const res1 = await fetch_request<MatchesResponse>('matches_router', router)
            if (!res1 || res1.detail) {
                setError(res1?.detail || `${C.DATA} ${C.NOT_FOUND}`)
                return
            }
            res = res1
        }

        summaryMatches.current = initial_date_data([...summaryMatches.current.matches, ...res.matches])
        dateMatches.current = Object.entries(
            Object.groupBy(
                summaryMatches.current.matches, ({ time }) => time.split('T')[0]
            )
        ).map(date => [RouterDateSchema.parse(date[0]), initial_date_data(date[1]!)])
        setPageData(prev => {
            const found = router.page > 1 ? prev.found : res.found
            return {
                found,
                is_has_more: summaryMatches.current.matches.length < found,
            }
        })
    }

    useEffect(() => {
        if (inView) load_matches()
    }, [inView])

    const { game, mode } = router
    const order = order_status<RouterOrder>(router.order)
    const matches_loaded = summaryMatches.current.matches.length
    const date_at = dateMatches.current.at(-1)?.[0]
    const is_time_order = order.column === C.TIME
    const is_all_matches = (game === C.ALL || game === C.MW) && mode === C.ALL

    const order_matches = (set_order: RouterOrder) => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
        const { new_order } = order_change<RouterOrder>(order.current, set_order, true)

        if (pageData.is_has_more) {
            push(router_generate_url({ ...router, order: new_order }))
        } else {
            router.order = new_order
        }
        setPageData(prev => ({ ...prev }))
    }

    const MatchRow = ({ match, is_same_map }: { match: MatchesData, is_same_map: boolean }) => (
        <tr
            className="
                cursor-pointer text-white opacity-70 hover:opacity-90
                bg-fixed bg-contain bg-center"
            style={{
                backgroundImage: `
                    linear-gradient(
                        90deg,
                        rgb(30, 36, 57, 0.1),
                        .1%,
                        rgba(30, 36, 57, 0.6)
                    ),
                    url('${get_map_img(match.game_mode, match.map.name)}')
                    `
            }}
            onClick={() => modal_open(
                <MatchStatsCard
                    match_body={{
                        game_mode: match.game_mode,
                        match_id: match.id,
                        source: match.source,
                        year: YearSchema.parse(new Date(match.time).getFullYear()),
                    }}
                    is_modal={true}
                />
            )}
        >
            <td
                className={`
                p-2 border-t-4 border-l-2 border-solid
                bg-gradient-to-br to-gray-800
                ${is_same_map ? 'border-l-white' : ''}
                ${get_result_color(match.result, match.game_mode, 'border')}
                ${get_result_color(match.result, match.game_mode, 'from')}`}
            >
                {is_all_matches ? (
                    <IconGameMode game_mode={match.game_mode} size={28} />
                ) : match.game_mode === C.MW_WZ ? (
                    <span
                        className={get_result_color(match.result, match.game_mode, 'text')}
                        title={`${t(C.PLACE)} ${match.result}`}
                    >{match.result}</span>
                ) : (
                    <span
                        className={get_result_color(match.result, match.game_mode, 'text')}
                        title={`${t(C.RESULT)} ${match.result}`}
                    >{t(MATCH_RESULT_MP[match.result as MatchResultMp])}</span>
                )}
            </td>

            <td title={`${get_ago(match.time)}\n${date_format(match.time)}`}>
                {is_time_order ? date_format(match.time, C.TIME) : match.time.split('T')[0]}
            </td>

            <td title={C.PLAYER} className="p-2">{match.player}</td>

            {GameBasicColumnSchema.options.map(stat_name => (
                <td
                    key={`${C.MATCH}_${stat_name}`}
                    className={`p-1 ${order.column === stat_name ? 'text-orange-300' : ''}`}
                >{format_stat(stat_name, match[stat_name])}</td>
            ))}
        </tr>
    )

    const SummaryGamesCount = ({ date_data }: { date_data: DateData }) => {
        const top_loadouts = Object.entries(date_data.loadout)
            .sort(([, a_uses], [, b_uses]) => b_uses - a_uses)
        top_loadouts.length = top_loadouts.length > 6 ? 6 : top_loadouts.length
        const summary_matches = date_data.win + date_data.loss + date_data.draw

        return <>
            <div className="text-[.7rem] text-gray-400 peer" title={summary_matches.toString()}>
                {date_data.win > 0 && (
                    <span className={get_result_color(MatchResultMpSchema.enum.WIN, C.MW_MP, 'text')}>
                        {date_data.win}
                        {(date_data.loss || date_data.draw) > 0 ? ' - ' : ''}
                    </span>
                )}
                {date_data.loss > 0 && (
                    <span className={get_result_color(MatchResultMpSchema.enum.LOSS, C.MW_MP, 'text')}>
                        {date_data.loss}
                    </span>
                )}
                {date_data.draw > 0 && (
                    <span className={get_result_color(MatchResultMpSchema.enum.DRAW, C.MW_MP, 'text')}>
                        {date_data.loss ? ' - ' : ''}
                        {date_data.draw}
                    </span>
                )}
            </div>
            {top_loadouts.length > 0 && (
                <div className="
                p-2 z-[2] text-[.7rem] absolute hidden peer-hover:block hover:block
                backdrop-blur w-max text-left text-zinc-300 rounded-md"
                >
                    <p className="text-center">{t(C.LOADOUT)}</p>
                    <div className="text-left">
                        {top_loadouts.map(([name, uses]) => <p key={name}>{uses} [{name}]</p>)}
                    </div>
                </div>
            )}
        </>
    }

    const StatColumn = ({ stat_name }: { stat_name: GameBasicColumn }) => {
        const is_asc = order.column === stat_name && !order.is_desc
        const is_desc = order.column === stat_name && order.is_desc
        const color_order = is_desc ? 'text-orange-400' : is_asc ? 'text-orange-300' : ''
        const color_stat = stat_name === C.KDRATIO ? 'text-yellow-400/90' :
            stat_name === 'longestStreak' ? 'text-green-700' : 'text-green-400'

        const summary_value = format_stat(stat_name, summaryMatches.current.stats[stat_name])
        const game_stats = target_data?.games_stats?.[game]
        const total_games_played = game_stats?.all.totalGamesPlayed || 0
        const stat_value = game_stats?.all[stat_name] || 0

        const AverageTableValues = () => {
            if (matches_loaded < 2) return null

            if (stat_name === 'longestStreak') {
                return (
                    <table className="table_logs popUp">
                        <thead>
                            <tr>
                                <th>{t(C.MATCHES)}</th>
                                <th>{t('best')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>{matches_loaded}</td>
                                <td className={color_stat}>{summary_value}</td>
                            </tr>
                            <tr>
                                <td>{total_games_played}</td>
                                <td className={color_stat}>{stat_value}</td>
                            </tr>
                        </tbody>
                    </table>
                )
            }

            if (stat_name === C.KDRATIO) {
                return (
                    <table className="table_logs popUp">
                        <thead>
                            <tr>
                                <th>{t(C.MATCHES)}</th>
                                <th>{t('average')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>{matches_loaded}</td>
                                <td className={color_stat}>{summary_value}</td>
                            </tr>
                            <tr>
                                <td>{total_games_played}</td>
                                <td className={color_stat}>{stat_value.toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                )
            }

            if (stat_name === C.TIME_PLAYED || stat_name === C.DURATION) {
                return (
                    <table className="table_logs popUp">
                        <thead>
                            <tr>
                                <th>{t(C.MATCHES)}</th>
                                <th>{t('average')}</th>
                                <th>{t(C.SUMMARY)}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>{matches_loaded}</td>
                                <td className="text-yellow-400/80">
                                    {seconds_to_duration(summaryMatches.current.stats[stat_name] / matches_loaded)}
                                </td>
                                <td className="text-green-400">{summary_value}</td>
                            </tr>
                        </tbody>
                    </table>
                )
            }

            return (
                <table className="table_logs popUp">
                    <thead>
                        <tr>
                            <th>{t(C.MATCHES)}</th>
                            <th>{t('average')}</th>
                            <th>{t(C.SUMMARY)}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>{matches_loaded}</td>
                            <td className="text-yellow-400/80">
                                {round_number(summaryMatches.current.stats[stat_name] / matches_loaded)}
                            </td>
                            <td className="text-green-400">{summary_value}</td>
                        </tr>
                        {stat_value > 0 && (
                            <tr>
                                <td>{total_games_played}</td>
                                <td className="text-yellow-400/80">{round_number(stat_value / total_games_played)}</td>
                                <td className="text-green-400">{stat_value.toLocaleString()}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )
        }

        return (
            <th className="px-1">
                <button
                    type="button"
                    title={`${t(`${C.ORDER} by ${is_desc ? 'asc' : 'desc'} ${stat_name}`)}`}
                    onClick={() => order_matches(stat_name as RouterOrder)}
                    className={`hover:text-blue-300 inline-flex ${color_order}`}
                >{stat_name === C.HEADSHOTS ? <IconHeadshot /> : t(stat_name)}</button>

                <div className="dropdown text-[.7rem] flex gap-2 justify-center">
                    <div className={color_stat}>{summary_value}</div>
                    <AverageTableValues />
                    <span className={`${color_order} float-right`}>
                        {is_asc ? '↑' : is_desc ? '↓' : ''}
                    </span>
                </div>
            </th>
        )
    }

    const MatchesBody = useMemo(() => {
        if (is_time_order) {
            const ShowDate = ({ date }: { date: string }) => {
                const [year, month, day] = date.split('-').map(i => +i)
                const month_name = capitalize(new Date(year, month, day).toLocaleString(
                    profile.language, { month: 'long' }
                ))

                if (!day) return <span>{month_name} {year}</span>

                const _date = new Date(year, month, day)
                const week_name = capitalize(
                    _date.toLocaleString(profile.language, { weekday: 'long' })
                )

                return (
                    <div title={`${week_name} ${date}`}>
                        {date_format(_date, C.DATE)}
                    </div>
                )
            }

            return (
                <tbody>
                    {(order.is_desc ? dateMatches.current : dateMatches.current.toReversed()).map(([date, data]) => (
                        <Fragment key={date}>
                            <tr>
                                <td />
                                <td className="p-2">
                                    <Link
                                        className="text-violet-500 hover:text-violet-500/80"
                                        title={date}
                                        href={router_generate_url({ ...router, date })}
                                    ><ShowDate date={date} /></Link>
                                </td>
                            </tr>

                            {data.matches
                                .sort((a, b) => {
                                    let a_count = new Date(a.time).getTime()
                                    let b_count = new Date(b.time).getTime()
                                    if (order.is_desc) {
                                        [a_count, b_count] = [b_count, a_count]
                                    }
                                    return a_count - b_count
                                })
                                .map(match =>
                                    <MatchRow
                                        key={`${C.MATCH}_${match.time}`}
                                        match={match}
                                        is_same_map={data.is_same_map}
                                    />)}

                            {data.matches.length > 1 && (
                                <tr className="shadow-lg">
                                    <td><SummaryGamesCount date_data={data} /></td>
                                    <td /><td />
                                    {GameBasicColumnSchema.options.map(stat_name => (
                                        <td
                                            key={`${C.MATCHES}_${C.SUMMARY}_${stat_name}`}
                                            className={stat_name === 'longestStreak' ? 'text-green-700' : 'text-green-400/80'}
                                            title={t(stat_name === 'longestStreak' ? `best ${stat_name}` :
                                                `${C.SUMMARY} for ${data.matches.length} ${C.MATCHES}`)}
                                        >{format_stat(stat_name, data.stats[stat_name])}</td>
                                    ))}
                                </tr>
                            )}
                        </Fragment>
                    ))}
                </tbody>
            )
        }

        const matches_sorted_by_value = Object.entries(
            Object.groupBy(
                summaryMatches.current.matches,
                match => match[order.column]
            )
        )
            .sort(([a_value], [b_value]) => {
                let a_count = +a_value
                let b_count = +b_value
                if (order.is_desc) {
                    [a_count, b_count] = [b_count, a_count]
                }
                return a_count - b_count
            })
            .map(([, matches]) => matches!.sort((a, b) => {
                let a_count = a.deaths
                let b_count = b.deaths
                if (order.is_desc) {
                    [a_count, b_count] = [b_count, a_count]
                }
                return b_count - a_count
            }))
            .flat(1)
            .map(match => (
                <MatchRow
                    key={`${C.MATCH}_${match.time}`}
                    match={match}
                    is_same_map={summaryMatches.current.is_same_map}
                />
            ))

        return <tbody>{matches_sorted_by_value}</tbody>
    }, [pageData])

    if (error) {
        return (
            <div className="flex justify-center">
                <span className="message-error">{t(error)}</span>
            </div>
        )
    }

    return <>
        <h4 className="p-2 text-center">
            <p className="font-bold">
                {pageData.found ? <>
                    {pageData.found} {t(C.MATCHES)}
                    {router.date && <span> [{router.date}]</span>}
                </> : (
                    `${t(`${C.LOADING} ${C.MATCHES}`)}...`
                )}
            </p>
        </h4>

        {target_data?.chart && date_at && (
            <MatchesChart
                router={router}
                chart={target_data.chart}
                date_at={date_at}
            />
        )}

        <table className="text-center font-semibold border-separate">
            <thead className="sticky-top top-0">
                <tr>
                    <th>
                        {t(is_all_matches ? C.GAME : mode === C.WZ ? C.PLACE : C.RESULT)}
                        <SummaryGamesCount date_data={summaryMatches.current} />
                    </th>
                    <th>
                        <button
                            type="button"
                            title={`${t(`${C.ORDER} by ${is_time_order && order.is_desc ? 'asc' : 'desc'} ${C.TIME}`)}`}
                            onClick={() => order_matches(C.TIME)}
                            className={`hover:text-blue-300 ${!is_time_order ? '' : order.is_desc ? 'text-orange-400' : 'text-orange-300'}`}
                        >{t(C.TIME)}</button>
                        <div className="text-[.7rem] flex gap-2 justify-center">
                            <span className="text-green-400">
                                {matches_loaded} {t(C.MATCHES)}
                            </span>
                            {is_time_order && (
                                <span className={`float-right ${order.is_desc ? 'text-orange-400' : 'text-orange-300'}`}>
                                    {order.is_desc ? '↓' : '↑'}
                                </span>
                            )}
                        </div>
                    </th>
                    <th className="px-1">{t(C.PLAYER)}</th>
                    {GameBasicColumnSchema.options.map(stat_name => <StatColumn key={stat_name} stat_name={stat_name} />)}
                </tr>
            </thead>
            {MatchesBody}
        </table >

        {pageData.is_has_more ? (
            <button
                type="button"
                className="mb-4 text-center hover:text-blue-300"
                ref={ref}
                title={t(`click for load more ${C.MATCHES}`)}
                onClick={load_matches}
            >{t('load more')}</button>
        ) : (
            <div className="m-16 mb-4 text-center">
                {t(`no more ${C.MATCHES}`)}
            </div>
        )}
    </>
}

const MatchesChart = ({ router, chart, date_at }: {
    router: Router
    chart: Chart
    date_at: string
}) => {
    const { t, profile } = useAppContext()

    const date_at_slugs = date_at.split('-').map(i => (+i).toString())
    const year_at = YearSchema.parse(date_at_slugs[0])
    const month_at = MonthSchema.parse(date_at_slugs[1])
    const day_at = MonthDaySchema.parse(date_at_slugs[2])

    const date_slugs = router.date.split('-').filter(Boolean).map(i => (+i).toString())
    const slug_year = date_slugs[0] && YearSchema.parse(date_slugs[0])
    const slug_month = date_slugs[1] && MonthSchema.parse(date_slugs[1])
    const slug_day = date_slugs[2] && MonthDaySchema.parse(date_slugs[2])

    const current_year_input = YearSchema.safeParse(new Date().getFullYear())
    const start_year = current_year_input.success ?
        current_year_input.data : YearMpSchema.options.at(-1)!
    const current_month = MonthSchema.parse((new Date().getMonth() + 1))

    const [year, setYear] = useState(start_year)
    const [month, setMonth] = useState(current_month)

    useEffect(() => {
        if (slug_year) {
            setYear(slug_year)
            setMonth(slug_month || month_at)
        } else if (year_at) {
            setYear(year_at)
            setMonth(month_at)
        }
    }, [date_at])

    const { target, game, mode } = router
    const data = chart[router.game_mode]

    if (!data.summ) return null

    const change_date = (change: -1 | 1) => {
        const changed_month = +month + change
        const new_month = MonthSchema.safeParse(changed_month)
        if (new_month.success) {
            setMonth(new_month.data)
            return
        }

        const new_year = YearSchema.safeParse(+year + change)
        if (new_year.success) {
            setYear(new_year.data)
            setMonth(changed_month === 0 ? MonthsSchema.enum.December : MonthsSchema.enum.January)
        }
    }

    const is_at_begin = year === YearMpSchema.options[0] && month === MonthsSchema.enum.January
    const is_at_end = year === YearMpSchema.options.at(-1) && month === MonthsSchema.enum.December
    const is_choosen_year = slug_year === year && !slug_month && !slug_day
    const is_choosen_month = slug_year === year && slug_month === month && !slug_day

    const first_month_day_in_week = new Date(+year, +month, 1).getDay() || 7
    const column_start = {
        1: 'col-start-1',
        2: 'col-start-2',
        3: 'col-start-3',
        4: 'col-start-4',
        5: 'col-start-5',
        6: 'col-start-6',
        7: 'col-start-7',
    }[first_month_day_in_week]

    const chart_year = data.years[year]
    const _date = new Date(+year, +month, 0)
    const month_name = capitalize(_date.toLocaleString(profile.language, { month: 'long' }))
    const month_days = Array.from(Array(_date.getDate()).keys()).map(x => (x + 1).toString()) as MonthDay[]
    const month_grid = month_days.map(month_day => {
        const weekday = capitalize(new Date(+year, +month, +month_day).toLocaleString(
            profile.language, { weekday: 'long' }
        ))
        const games = chart_year?.months[month]?.days[month_day] || 0

        const is_choosen = slug_year === year && slug_month === month && slug_day === month_day
        const is_choosen_current = year === year_at && month_at === month && day_at === month_day
        const bg_indicator_style =
            is_choosen ? 'bg-indigo-500'
                : !games ? ''
                    : games < 10 ? 'bg-yellow-300/20'
                        : games < 20 ? 'bg-yellow-300/40'
                            : games < 30 ? 'bg-yellow-300/60'
                                : 'bg-yellow-300/80'

        return (
            <Link
                key={`${year}-${month}_${month_day}`}
                title={`${weekday}\n${t(C.GAMES)}: ${games}`}
                className={`
                h-5 w-5 flex items-center justify-center rounded-md
                ${bg_indicator_style} ${month_day === '1' ? column_start : ''}
                ${games ? 'text-white hover:bg-indigo-500' : 'hover:text-indigo-500'}
                ${!is_choosen_month && is_choosen_current ? 'border-2 border-indigo-500' : ''}
                ${!games || is_choosen ? 'cursor-default' : ''}`}
                href={router_generate_url({
                    data_type: C.MATCHES,
                    target, game, mode,
                    date: RouterDateSchema.parse(`${year}-${month}-${month_day}`)
                })}
            ><time dateTime={`${year}-${month}-${month_day}`}>{month_day}</time></Link>
        )
    })

    return (
        <div className="text-center m-2xl:hidden fixed top-20 right-8">
            <div className="p-1 dropdown">
                {t(C.CHART)}
                <div className="popUp popUp-left">
                    <FormatedTime time={chart.time} title={t('updated')} />
                    <p>{t(`${C.ALL} ${C.SUMMARY} ${C.GAMES}`)}: {data.summ}</p>
                </div>
            </div>
            <div className="p-2 rounded-2xl bg-slate-800/50 shadow-lg">
                <div className="flex items-center justify-between">
                    <time className="font-bold text-xl flex gap-2 items-center">
                        <Link
                            href={router_generate_url({
                                data_type: C.MATCHES,
                                target, game, mode,
                                date: RouterDateSchema.parse(`${year}-${month}`)
                            })}
                            className={`
                                dropdown
                                ${is_choosen_month ? 'cursor-default text-indigo-500' :
                                    !chart_year?.months[month]?.summ ? 'cursor-default' :
                                        'text-amber-500  hover:text-indigo-500'}`}
                        >
                            <time>{month_name}</time>
                            <span className="popUp popUp-left text-sm">
                                {t(`${C.SUMMARY} month`)}: {chart_year?.months[month]?.summ || 0}
                            </span>
                        </Link>
                        <div className="dropdown">
                            <Link
                                href={router_generate_url({ data_type: C.MATCHES, target, game, mode, date: year })}
                                className={`
                                    dropdown
                                    ${is_choosen_year ? 'cursor-default text-indigo-500' :
                                        !chart_year?.summ ? 'cursor-default' :
                                            'text-amber-500  hover:text-indigo-500'}`}
                            >
                                <time>{year}</time>
                                <span className="popUp popUp-left text-left text-sm">
                                    {t(`${C.SUMMARY} ${C.YEAR}`)} {chart_year?.summ}
                                </span>
                            </Link>
                        </div>
                    </time>
                    <button
                        type="button"
                        title={t('previus month')}
                        disabled={is_at_begin}
                        onClick={() => change_date(-1)}
                        className="disabled:opacity-50 hover:text-blue-300"
                    ><IconArrowLeft /></button>
                    <button
                        type="button"
                        title={t('next month')}
                        disabled={is_at_end}
                        onClick={() => change_date(1)}
                        className="disabled:opacity-50 hover:text-blue-300"
                    ><IconArrowRight1 /></button>
                </div>

                <div className="text-xs grid grid-cols-7 gap-y-1">
                    {['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'].map(day => (
                        <div key={day} title={t(`long_${day}`)}>{t(day)}</div>
                    ))}
                    {month_grid}
                </div>
            </div>
        </div >
    )
}
