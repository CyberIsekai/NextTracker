'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import useAppContext from '@/app/components/AppContext'
import FormatedTime from '@/app/components/jsx/FormatedTime'
import MatchStatsProgress from '@/app/components/jsx/MatchStatsProgress'
import { useMatchesStatsContext } from '@/app/(MatchesStats)/navigation'
import {
  IconArrowDown,
  IconArrowUp,
  IconGameMode
} from '@/app/components/Icons'
import { C } from '@/app/components/Consts'
import {
  PlayerData,
  PlayerDataBasic,
} from '@/app/components/zod/Player'
import {
  GameStatsBest,
  GameStatsBestPlayerRecord,
  GroupData,
} from '@/app/components/zod/Group'
import {
  is_best_record,
  is_group,
  validate_game_mode,
} from '@/app/components/UtilsValidators'
import {
  extract_number_value,
} from '@/app/components/Utils'
import {
  router_generate_url,
  get_ago,
  get_percent,
  order_change,
  format_seconds_ago,
  target_data_cache_get,
} from '@/app/components/UtilsClient'
import {
  Game,
  Mode,
  GameMode,
  GameModeSchema,
  game_mode_split,
} from '@/app/components/zod/GameMode'
import {
  GameStatsDataKeyAll,
  GameStatsDataKeyAllSchema,
  GameStatsDataKeySimpleSchema,
  GameStatsDataStats,
} from '@/app/components/zod/GamesStats'
import { LoadoutStatsData } from '@/app/components/zod/Loadout'
import { MostPlayWithData } from '@/app/components/zod/MostPlayWith'
import { PlayerUno } from '@/app/components/zod/Uno'

export default function Stats() {
  const { t, s } = useAppContext()
  const { router, target_data } = useMatchesStatsContext()

  const [players, setPlayers] = useState<Record<string, PlayerData>>({})
  const loading = useRef(false)

  const { game, mode, game_mode } = router
  const mw_mode = game === C.ALL ? C.ALL : mode === C.WZ ? C.MW_WZ : C.MW_MP
  const game_stats = target_data?.games_stats?.[game]

  const fetch_data = async () => {
    if (
      loading.current ||
      !is_group(target_data) ||
      target_data.uno === C.TRACKER
    ) return
    loading.current = true
    const new_players: Record<PlayerUno, PlayerData> = {}
    for (const uno in target_data.players) {
      new_players[uno] = players[uno] || await target_data_cache_get(uno)
    }
    setPlayers(new_players)
    loading.current = false
  }

  useEffect(() => {
    fetch_data()
  }, [target_data])

  if (!target_data) {
    return <div className="p-8">{t(C.LOADING)}...</div>
  }

  const player_game_list = GameModeSchema.options.filter(game_mode => (
    game_mode === C.ALL || target_data.games[game_mode].status
  ))
  const SHOW_LIMIT = 100

  return <>
    {game === C.ALL && <>
      <div className="p-2 flex gap-2">
        <div>{t(`${C.ALL} used`)}</div>
        <div className="dropdown">
          <span className="text-white hover:text-blue-400">
            {t('usernames')} [{target_data.username.length}]
          </span>
          <div className="popUp">
            {target_data.username.length > SHOW_LIMIT && (
              <span className="flex justify-center">
                {t(`last ${SHOW_LIMIT}`)}
              </span>
            )}
            <div className="grid grid-cols-3 gap-x-1">
              {target_data.username.slice(0, SHOW_LIMIT).map(username => (
                <Link
                  key={username}
                  className="link text-amber-500"
                  href={router_generate_url({ data_type: C.USERNAME, target: username, game, mode })}
                >{username}</Link>
              ))}
            </div>
          </div>
        </div>

        <div className="dropdown">
          <span className="text-white hover:text-blue-400">
            {t('clantags')} [{target_data.clantag.length}]
          </span>
          <div className="popUp">
            {target_data.clantag.length > SHOW_LIMIT && (
              <span className="flex justify-center">
                {t(`last ${SHOW_LIMIT}`)}
              </span>
            )}
            <div className="grid grid-cols-6 gap-x-1">
              {target_data.clantag.slice(0, SHOW_LIMIT).map(clantag => (
                <Link
                  key={clantag}
                  className="link text-amber-500"
                  href={router_generate_url({ data_type: C.CLANTAG, target: clantag, game, mode })}
                >{clantag}</Link>
              ))}
            </div>
          </div>
        </div>
      </div>
      <table className="table_logs">
        <thead>
          <tr>
            <th />
            {player_game_list.map(game_mode => (
              <th key={game_mode}>
                <IconGameMode game_mode={game_mode} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.keys(target_data.games.all.matches.stats).map(name => (
            <tr key={name}>
              <th className="text-left">{t(name)}</th>
              {player_game_list.map(game_mode => {
                const stat = target_data.games[game_mode].matches.stats[name]
                return (
                  <th key={game_mode} className={!stat ? 'opacity-50' : ''}>
                    {stat.toLocaleString()}
                  </th>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </>}

    {(game === C.MW || game === C.ALL) && (
      <div className="p-4">
        {target_data.loadout && (
          <LoadoutsTable
            data={target_data.loadout[mw_mode]}
            time={target_data.loadout.time}
          />
        )}

        {target_data.most_play_with && (
          <MostPlayTable
            data={target_data.most_play_with[mw_mode]}
            game={game}
            mode={mode}
            time={target_data.most_play_with.time}
          />
        )}
      </div>
    )}

    {is_group(target_data) && target_data.uno !== C.TRACKER && (
      <div className="max-w-[80vw]">
        {game === C.ALL && <GroupStats group={target_data} />}
        {GameStatsDataKeyAllSchema.options.map(stats_name => (
          <PlayersStats
            key={stats_name}
            group={target_data}
            players_data={Object.values(players)}
            game={game}
            mode={mode}
            stats_name={stats_name}
          />
        ))}
      </div >
    )}

    <div className="w-[65vw]">
      <h2 className="p-4 text-center text-2xl">
        <FormatedTime
          time={target_data.games[game_mode].stats.logs[0].time}
          title={t('updated')}
        />
      </h2>

      {game_stats && GameStatsDataKeyAllSchema.options.map(stats_name => {
        const stats = game_stats[stats_name]
        if (!stats || !Object.keys(stats).length) return null

        return (
          <div key={stats_name}>
            <h2 className="dropdown p-4 flex justify-center text-3xl hover:text-blue-300">
              {s(stats_name)}
              {typeof stats.all === 'object' && (
                <div className="popUp text-left text-base -mt-20">
                  <StatValueFormat stat_value={stats.all} title={stats_name} />
                </div>
              )}
            </h2>

            <div className="grid gap-3 grid-cols-4">
              {Object.entries(stats).map(([stat_name, stat_value]) => {
                if (stat_name === C.ALL) return null
                return (
                  <div
                    key={`${stats_name}_${stat_name}`}
                    className="
                    dropdown p-1 text-center rounded break-normal
                    bg-sky-500/10 hover:bg-sky-500/20"
                  >
                    <p>{s(stat_name)}</p>
                    <p className="text-blue-400">{extract_number_value(stat_value)}</p>
                    {typeof stat_value === 'object' && (
                      <div className="popUp text-left">
                        <StatValueFormat stat_value={stat_value} title={stat_name} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

    </div>
  </>
}

const PlayersStats = ({ group, players_data, game, mode, stats_name }: {
  group: GroupData
  players_data: PlayerData[]
  game: Game
  mode: Mode
  stats_name: GameStatsDataKeyAll
}) => {
  const { t, s } = useAppContext()
  const [order, setOrder] = useState<string>(C.PLAYER)
  const [players, setPlayers] = useState(players_data)

  const is_simple_stats = GameStatsDataKeySimpleSchema.safeParse(stats_name).success
  const group_stats = group.games_stats[game]?.[stats_name]
  const group_stats_best = group.games_stats_best[game]?.[stats_name]
  const game_mode = validate_game_mode(`${game}_${mode}`)

  useEffect(() => {
    setPlayers(players_data)
  }, [players_data])

  if (!group_stats || !group_stats_best) return null

  const order_stats = (set_order: string) => {
    const { new_order, is_desc } = order_change(order, set_order, true)
    setOrder(new_order)
    setPlayers(prev => prev.sort((a, b) => {
      let a_count = extract_number_value(a.games_stats[game]?.[stats_name]?.[set_order])
      let b_count = extract_number_value(b.games_stats[game]?.[stats_name]?.[set_order])

      if (!a_count) return 1
      if (!b_count) return -1

      if (is_desc) {
        [a_count, b_count] = [b_count, a_count]
      }

      return a_count - b_count
    }))
  }

  return (
    <div>
      <h2 className="dropdown p-4 flex justify-center text-3xl hover:text-blue-300">
        {s(stats_name)}
        {typeof group_stats.all === 'object' && (
          <div className="popUp text-left text-base -mt-20">
            <StatValueFormat stat_value={group_stats.all} title={stats_name} />
          </div>
        )}
      </h2>
      <div className="players-stats">
        <table className="table_logs">
          <thead>
            <tr className="cursor-pointer">
              <th className="horizontal-sticky">{t(C.PLAYER)}</th>
              {Object.entries(group_stats).map(([stat_name, stat_value]) => {
                if (stat_name === C.ALL) return null
                const label = stats_name.toString().includes('weapon') ||
                  stats_name === 'attachment' ? stat_name : s(stat_name)
                const is_asc = order === stat_name
                const is_desc = order === `-${stat_name}`

                return (
                  <th key={`${stats_name}_${stat_name}`}>
                    <button
                      type='button'
                      title={`${t(`sort by ${is_asc ? 'desc' : 'asc'}`)} ${label} (${stat_name})`}
                      className={`
                      hover:text-blue-300 inline-flex
                      ${is_desc ? 'text-orange-400' : is_asc ? 'text-orange-300' : ''}`}
                      onClick={() => order_stats(stat_name)}
                    >{label}</button>

                    <div className="text-[.7rem] cursor-default">
                      <StatsShow stat_value={stat_value} stat_name={stat_name} />
                      <span> {is_asc ? '↑' : is_desc ? '↓' : ''}</span>
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {players.map(player => {
              const username = player.username[0]
              const last_log = player.games[game_mode].stats.logs[0]
              const game_stats = player.games_stats[game]?.[stats_name]
              if (!game_stats) return null

              return (
                <tr key={`${C.PLAYER}_${stats_name}_${player.uno}`}>
                  <td className="horizontal-sticky">
                    <div className="dropdown">
                      <Link href={router_generate_url({ data_type: C.STATS, target: player.uno, game, mode })}>
                        {username}
                      </Link>
                      <span className="popUp left-28 -mt-16">
                        {t('updated')} {get_ago(last_log.time)}
                        {typeof game_stats.all === 'object' && (
                          <StatValueFormat stat_value={game_stats.all} title={stats_name} />
                        )}
                      </span>
                    </div>
                  </td>

                  {Object.keys(group_stats).map(stat_name => {
                    if (stat_name === C.ALL) return null
                    let stat_best: GameStatsBestPlayerRecord | undefined
                    if (is_simple_stats) {
                      stat_best = group_stats_best[stat_name] as GameStatsBestPlayerRecord
                    } else {
                      const record = group_stats_best[stat_name] as GameStatsBest['scorestreak']['all']
                      stat_best = record.kills ?? record.uses ?? record.used
                    }
                    const is_stat_best = player.uno === stat_best?.uno

                    return (
                      <td
                        key={`${player.uno}_${stats_name}_${stat_name}`}
                        className={`
                        text-center
                        ${order.replace('-', '') === stat_name ? 'text-orange-300' : 'text-zinc-200'}
                        ${is_stat_best ? 'bg-amber-300/30' : ''}`}
                      >
                        <StatsShow
                          stat_value={game_stats[stat_name]}
                          stat_name={stat_name}
                          username={username}
                        />
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const StatValueFormat = ({ stat_value, title }: { stat_value: GameStatsDataStats, title: string }) => {
  const { s } = useAppContext()

  const stats_name_value = Object.entries(stat_value)
  if (!stats_name_value.length) return null
  return <>
    <h3 className="basic-title p-2 text-center text-2xl font-bold">{s(title)}</h3>
    {stats_name_value.map(([name, value]) => (
      <p key={`${name}_${value}`}>
        <span>{s(name)}: </span>
        <span className="text-amber-400/80">
          {value.toLocaleString()}
        </span>
      </p>
    ))}
  </>
}

const StatsShow = ({
  stat_name,
  stat_value,
  username,
}: {
  stat_name: string
  stat_value?: number | GameStatsDataStats
  username?: string
}) => {
  const { t, profile } = useAppContext()

  if (stat_value === undefined) return null

  const value = extract_number_value(stat_value)

  if (stat_name === 'timePlayedTotal') {
    return <div>{format_seconds_ago(value, profile.language)}</div>
  }

  return (
    <div
      className={`
      dropdown
      ${username ? '' : is_best_record(stat_name) ? 'text-green-700' : 'text-green-400'}`}
      title={stat_name}
    >
      {value.toLocaleString()}
      {typeof stat_value === 'object' && (
        <div className="popUp !fixed !w-[18rem] top-16 right-2">
          <h3 className="text-center text-base">{username || t(C.SUMMARY)}</h3>
          <div className="text-left">
            <StatValueFormat stat_value={stat_value} title={stat_name} />
          </div>
        </div>
      )}
    </div>
  )
}

const GroupStats = ({ group }: { group: GroupData }) => {
  const { t } = useAppContext()
  const [players, setPlayers] = useState<PlayerDataBasic[]>([])
  const [order, setOrder] = useState<string>(C.USERNAME)

  useEffect(() => {
    setPlayers(
      Object.values(group.players)
        .filter(player => player.games.all.matches.stats.matches)
        .sort((a, b) => a.username[0].localeCompare(b.username[0]))
    )
  }, [group])

  const sort_users = (set_order: C.USERNAME | GameMode) => {
    const { new_order, is_desc } = order_change(order, set_order, set_order !== C.USERNAME)
    setOrder(new_order)

    setPlayers(prev => prev.sort((a, b) => {
      if (set_order === C.USERNAME) {
        let a_username = a.username[0]
        let b_username = b.username[0]
        if (is_desc) {
          [a_username, b_username] = [b_username, a_username]
        }
        return a_username.localeCompare(b_username)
      }

      let a_count = a.games[set_order].matches.stats.matches
      let b_count = b.games[set_order].matches.stats.matches

      if (is_desc) {
        [a_count, b_count] = [b_count, a_count]
      }

      return a_count - b_count
    }))
  }

  const TargetRow = ({ target_data }: { target_data: PlayerDataBasic | GroupData }) => (
    <tr className={is_group(target_data) ? 'border-t' : ''}>
      <td className="text-left">
        <Link
          href={router_generate_url({ data_type: C.MATCHES, target: target_data.uno })}
          className="dropdown link"
        >
          {is_group(target_data) ? t(C.SUMMARY) : target_data.username[0]}
          <span className="popUp">{t(`open ${C.ALL} ${C.MATCHES}`)}</span>
        </Link>
      </td>

      {GameModeSchema.options.map(game_mode => {
        const [game, mode] = game_mode_split(game_mode)
        const game_status = target_data.games[game_mode]
        const completed_fullmatches = get_percent(
          game_status.matches.stats.fullmatches,
          game_status.matches.stats.matches
        )
        const is_completed = game === C.MW && completed_fullmatches > 95
        const color = is_completed ? 'text-green-400' : 'text-gray-400'

        return (
          <td key={`${game_mode}_${target_data.uno}`}>
            <Link
              href={router_generate_url({ data_type: C.STATS, target: target_data.uno, game, mode })}
              className={`dropdown ${color} hover:text-blue-500`}
            >
              {game_status.matches.stats.matches.toLocaleString()}
              <div className="popUp">
                <MatchStatsProgress matches_stats={game_status.matches.stats} />
              </div>
            </Link>
          </td>
        )
      })}
    </tr>
  )

  return <>
    <h4 className="basic-title dropdown p-4 text-center text-2xl">
      {t('summary_game_records')}
    </h4>
    <table className="table_logs">
      <thead>
        <tr>
          {([C.USERNAME] as const).map(column => (
            <th key={column}>
              <button
                type="button"
                title={t(`sort by ${column}`)}
                className="inline-flex"
                onClick={() => sort_users(column)}
              >
                {t(column)}
                {order === column ? '↑' : order === `-${column}` ? '↓' : ''}
              </button>
            </th>
          ))}

          {GameModeSchema.options.map(game_mode => (
            <th key={game_mode}>
              <button
                type="button"
                title={t(`sort by ${game_mode}`)}
                className="inline-flex"
                onClick={() => sort_users(game_mode)}
              >
                <IconGameMode game_mode={game_mode} size={22} />
                {order === game_mode ? '↑' : order === `-${game_mode}` ? '↓' : ''}
              </button>
            </th>
          ))}

        </tr>
      </thead>
      <tbody>
        {players.map(player => <TargetRow key={player.uno} target_data={player} />)}
        <TargetRow target_data={group} />
      </tbody>
    </table>
  </>
}

const LoadoutsTable = ({ data, time }: { data: LoadoutStatsData[], time: string }) => {
  const { t } = useAppContext()
  const LIMIT = 10
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    setShowAll(data.length <= LIMIT)
  }, [data])

  if (!data.length) return null

  return (
    <table className="table_logs inline-block align-top">
      <thead className='sticky top-1 z-[5]'>
        <tr>
          <th className="dropdown">
            {t(C.LOADOUT)} {data.length <= LIMIT && ` [${data.length}]`}
            <span className="popUp -mt-12">{t('updated')} {get_ago(time)}</span>
          </th>
          <th>{t(C.COUNT)}</th>
        </tr>
      </thead>
      <tbody>
        {(showAll ? data : data.slice(0, LIMIT)).map(loadout => (
          <tr key={`${loadout.name}_${loadout.count}`}>
            <td className="text-left">{loadout.name}</td>
            <td>{loadout.count}</td>
          </tr>
        ))}
        {data.length > LIMIT && (
          <tr
            className="group hover:!bg-transparent hover:!text-blue-500"
            title={t(`click for show ${showAll ? 'less' : C.ALL}`)}
            onClick={() => setShowAll(prev => !prev)}
          >
            <td>{t(`show ${showAll ? 'less' : C.ALL}`)} [{showAll ? LIMIT : data.length}]</td>
            <td>{showAll ? <IconArrowUp /> : <IconArrowDown />}</td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

const MostPlayTable = ({ data, game, mode, time }: {
  data: MostPlayWithData[]
  game: C.ALL | C.MW
  mode: Mode
  time: string
}) => {
  const { t } = useAppContext()
  const LIMIT = 10
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    setShowAll(data.length <= LIMIT)
  }, [data])

  if (!data.length) return null

  return (
    <table className="table_logs inline-block align-top">
      <thead className='sticky top-1 z-[5]'>
        <tr>
          <th className="dropdown">
            {t(C.MOST_PLAY_WITH)}  {data.length <= LIMIT && ` [${data.length}]`}
            <span className="popUp -mt-12">{`${t('updated')} ${get_ago(time)}`}</span>
          </th>
          <th>{t(C.COUNT)}</th>
        </tr>
      </thead>
      <tbody>
        {(showAll ? data : data.slice(0, LIMIT)).map(player => (
          <tr key={player.uno}>
            <td className="text-left">
              <span title={t(C.USERNAME)}>{player.username}</span>
              {player.clantag && <span title={t(C.CLANTAG)}> [{player.clantag}]</span>}
            </td>
            <td>
              <Link
                className="link text-amber-500"
                title={t(`${C.SEARCH} by ${C.UNO}`)}
                href={router_generate_url({ data_type: C.MATCHES, target: player.uno, game, mode })}
              >{player.count}</Link>
            </td>
          </tr>
        ))}

        {data.length > LIMIT && (
          <tr
            className="group hover:!bg-transparent hover:!text-blue-500"
            title={t(`show ${showAll ? 'less' : C.ALL}`)}
            onClick={() => setShowAll(prev => !prev)}
          >
            <td>{t(`show ${showAll ? 'less' : C.ALL}`)} [{showAll ? LIMIT : data.length}]</td>
            <td>{showAll ? <IconArrowUp /> : <IconArrowDown />}</td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
