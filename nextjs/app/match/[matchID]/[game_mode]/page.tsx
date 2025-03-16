'use client'

import {
  use,
  useState,
  useEffect,
} from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import useAppContext from '@/app/components/AppContext'
import FormatedTime from '@/app/components/jsx/FormatedTime'
import MatchStatsCard from '@/app/components/jsx/MatchStatsCard'
import { IconHeadshot } from '@/app/components/Icons'
import { C } from '@/app/components/Consts'
import {
  is_best_record,
  is_number,
} from '@/app/components/UtilsValidators'
import {
  fetch_request,
  get_map_img,
  format_label_data,
  order_change,
  get_result_color,
  order_status,
  seconds_to_duration,
} from '@/app/components/UtilsClient'
import {
  GAME_MODE_TITLES,
  GameModeOnlySchema,
} from '@/app/components/zod/GameMode'
import {
  MatchIDSchema,
  MatchColumn,
  MatchData,
  MatchParams,
  MatchPlayer,
  TeamData,
  MatchParamsOrderSchema,
  GameBasicColumnSchema,
  MatchColumnSchema,
} from '@/app/components/zod/Match'
import { YearSchema } from '@/app/components/zod/Table'

export default function Match({ params }: {
  params: Promise<{ matchID: string, game_mode: string }>
}) {
  const searchParams = useSearchParams()
  const { push } = useRouter()

  const { t, modal_open } = useAppContext()

  const [error, setError] = useState('')
  const [match, setMatch] = useState<MatchData>()

  const body = use(params)
  const matchID = MatchIDSchema.parse(body.matchID)
  const game_mode = GameModeOnlySchema.parse(body.game_mode)

  const title = GAME_MODE_TITLES[game_mode]
  const is_wz = game_mode === C.MW_WZ
  const order = order_status<MatchColumn | C.RESULT>(MatchParamsOrderSchema.parse(
    searchParams.get(C.ORDER) || (is_wz ? C.RESULT : `-${C.RESULT}`)
  ))
  const follow = searchParams.get('follow') || ''
  const is_team = searchParams.get(C.TEAM) === 'true' ? true :
    searchParams.get(C.TEAM) === 'false' ? false : (
      !match?.mode.name.includes('solo') && Object.keys(match?.team || {}).length < 80
    )

  const scroll_to = (id: string) => {
    const id_player = id && document.getElementById(id)
    if (id_player) {
      id_player.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      })
    }
  }

  const set_params = (new_params: MatchParams) => {
    const params = new URLSearchParams(searchParams.toString())
    const is_been_followed = params.get('follow')

    for (const [k, v] of Object.entries(new_params)) {
      if (v === undefined) continue
      const name = k as keyof MatchParams
      let value: string = v.toString()

      if (value === '') {
        params.delete(name)
        continue
      }

      if (name === C.ORDER) {
        const column_order = MatchParamsOrderSchema.parse(value)
        value = order_change(
          order.current, column_order, column_order !== C.RESULT
        ).new_order
      }

      params.set(name, value)
    }

    const follow = params.get('follow')

    if (follow) setTimeout(() => scroll_to(follow), 500)

    push(`?${params.toString()}`, { scroll: !is_been_followed && !follow })
  }

  const load_match = async () => {
    const res = await fetch_request<MatchData>(`match/${matchID}/${game_mode}`)
    if (!res || res.detail) {
      setError(res?.detail || `${C.DATA} ${C.NOT_FOUND}`)
      return
    }
    setMatch(res)
    setTimeout(() => scroll_to(follow), 1000)
  }

  useEffect(() => {
    load_match()
  }, [])

  if (error) {
    return (
      <h3 className="basic-title text-xl">
        <title>{title}</title>
        <p>{title}</p>
        <p>{t(error)}</p>
      </h3>
    )
  }
  if (!match) return <div>{t(C.LOADING)}...</div>

  const players = match.team.map(team => team.players).flat(1)

  const PlaceColumn = () => {
    if (!is_wz || is_team) return null
    const is_asc_place = order.column === C.RESULT && !order.is_desc
    const is_desc_place = order.column === C.RESULT && order.is_desc
    return (
      <th>
        <button
          type="button"
          title={t(`${C.ORDER} by ${is_asc_place ? 'asc' : 'desc'} ${C.PLACE}`)}
          className={is_desc_place ? 'text-orange-300' : is_asc_place ? 'text-orange-400' : undefined}
          onClick={() => set_params({ order: C.RESULT })}
        >{t(C.PLACE)}</button>
        <p className="float-right ml-1">
          {is_asc_place ? '↑' : is_desc_place ? '↓' : ''}
        </p>
      </th>
    )
  }

  const Thead = () => (
    <thead className="sticky-top top-0">
      <tr>
        <PlaceColumn />
        <th>
          <button
            type="button"
            title={t('default_order')}
            className="dropdown hover:text-blue-300"
            onClick={() => set_params({ order: C.RESULT, team: is_team ? undefined : true })}
          >{t(is_team ? C.TEAM : C.PLAYER)}</button>
          <div className="text-[.7rem] dropdown">
            <span>[{is_team ? match.team.length : players.length}] </span>
            <span className="float-right">
              {order.column !== C.RESULT ? '' : order.is_desc ? '↓' : '↑'}
            </span>
            <div className="popUp text-base text-left">
              {match.team.map(team => (
                <p key={team.name}>
                  {team.name}: {team.players.length}
                </p>
              ))}
            </div>
          </div>
        </th>

        {Object.entries(match.stats).map(([_, stat_value]) => {
          const stat_name = MatchColumnSchema.parse(_)
          const is_asc = order.column === stat_name && !order.is_desc
          const is_desc = order.column === stat_name && order.is_desc
          const is_best = is_best_record(stat_name)
          const color = is_asc ? 'text-orange-300' : is_desc ? 'text-orange-400' : ''
          const stat_value_formatted = stat_name === C.TIME_PLAYED ? seconds_to_duration(stat_value)
            : stat_value.toLocaleString()

          return (
            <th key={`${C.SUMMARY}_${stat_name}`} className="px-1">
              <button
                type="button"
                title={t(`${C.ORDER} by ${is_desc ? 'asc' : 'desc'} - ${stat_name}`)}
                className={`hover:text-blue-300 ${color}`}
                onClick={() => set_params({ order: stat_name })}
              >{stat_name === C.HEADSHOTS ? <IconHeadshot /> : t(stat_name)}</button>
              <div className="dropdown text-[.7rem]">
                <span className={` ${is_best ? 'text-green-700' : 'text-green-400'}`}>
                  {stat_value_formatted}
                </span>
                <span className={`float-right ${color}`}>
                  {is_asc ? '↑' : is_desc ? '↓' : ''}
                </span>
                <span className="popUp text-sm">
                  {t(is_best ? `best ${stat_name}` : `${C.SUMMARY} for ${players.length} ${C.PLAYERS}`)}
                </span>
              </div>
            </th>
          )
        })}
      </tr>
    </thead>
  )

  const TeamSummary = ({ team }: { team: TeamData }) => {
    const is_choosen_team = (
      team.name === follow ||
      team.players.map(({ username }) => username).includes(follow) ||
      team.players.map(({ clantag }) => clantag).includes(follow)
    )

    const ResultRow = () => {
      const players_in_team = team.players.length.toString()
      const players_count = <>
        <span>[{is_number(team.name) ? players_in_team : team.name}]</span>
        <span className="popUp">
          {players_in_team} {t(C.PLAYERS)}
        </span>
      </>

      if (!is_wz) {
        return (
          <td className={`dropdown ${get_result_color(team.players[0].result, game_mode, 'text')}`}>
            {players_count} [{team.result}]
          </td>
        )
      }

      if (team.result) {
        return (
          <td className={`dropdown ${get_result_color(team.result, game_mode, 'text')}`}>
            {team.result} {t(C.PLACE)} {players_count}
          </td>
        )
      }

      return (
        <td className="dropdown text-slate-500">
          {players_count}
        </td>
      )
    }

    return (
      <tr
        id={team.name}
        className={`
        p-3 rounded-xl shadow-lg border-white cursor-pointer
        ${team.name === follow ? 'bg-orange-500/40' : ''}`}
        title={`${t(`follow ${C.TEAM}`)} ${team.name} ?`}
        onClick={() => set_params({ follow: follow === team.name ? '' : team.name })}
      >
        <ResultRow />
        {Object.entries(team.stats).map(([_, stat_value]) => {
          const stat_name = MatchColumnSchema.parse(_)
          const color = order.column !== stat_name ?
            is_best_record(stat_name) ? 'text-green-700' : 'text-green-400' :
            is_choosen_team ? 'text-orange-600' : 'text-orange-500'
          const stat_value_formatted = stat_name === C.TIME_PLAYED ?
            seconds_to_duration(stat_value) : stat_value.toLocaleString()
          return (
            <td
              key={`${team.name}_${stat_name}`}
              className={`p-2 ${color}`}
            >{stat_value_formatted}</td>
          )
        })}
      </tr>
    )
  }

  const get_result_count = (result: number) => is_wz || result === 1 ? result : 0

  const PlayersRows = ({ players }: { players: MatchPlayer[] }) => players
    .sort((a, b) => {
      let a_count: number
      let b_count: number
      if (order.column === C.RESULT) {
        if (is_team) return b.stats.score - a.stats.score
        a_count = get_result_count(a[order.column])
        b_count = get_result_count(b[order.column])
      } else {
        a_count = a.stats[order.column]
        b_count = b.stats[order.column]
      }

      if (order.is_desc) {
        [a_count, b_count] = [b_count, a_count]
      }
      return a_count - b_count
    })
    .map(player => {
      const is_choosen_clantag = Boolean(player.clantag) && follow === player.clantag
      const is_choosen_uno = follow === player.uno
      const is_choosen_username = follow === player.username
      const is_choosen_row = is_choosen_uno || is_choosen_username || is_choosen_clantag

      return (
        <tr
          key={player.uno}
          id={player.uno}
          className={`
            group ${!is_wz ? 'odd:opacity-80' : ''}
            ${is_choosen_row ? 'bg-orange-500/40 text-orange-400' :
              get_result_color(player.result, game_mode, 'bg')}`}
        >
          {is_wz && !is_team && (
            <td>
              <span
                className={get_result_color(player.result, game_mode, 'text')}
                title={`${t(C.PLACE)} ${player.result}`}
              >{player.result}</span>
            </td>
          )}

          <td className="p-2 flex justify-start gap-2 group-hover:bg-black/20">
            {player.clantag && (
              <button
                type="button"
                id={player.clantag}
                title={`${t(`follow ${C.CLANTAG}`)} ${player.clantag} ?`}
                onClick={() => set_params({
                  follow: is_choosen_clantag ? '' :
                    is_choosen_username ? player.uno : player.clantag || ''
                })}
                className={`hover:text-blue-400 ${is_choosen_uno || is_choosen_clantag ? '' : 'text-blue-100'}`}
              >[{player.clantag}]</button>
            )}
            <button
              type="button"
              id={player.username}
              title={`${t(`follow ${C.PLAYER}`)} ${player.username} ?`}
              onClick={() => set_params({
                follow: is_choosen_username ? '' :
                  is_choosen_clantag ? player.uno : player.username
              })}
              className={`hover:text-blue-400 ${is_choosen_uno || is_choosen_username ? '' : 'text-blue-300'}`}
            >{player.username}</button>
          </td>

          {GameBasicColumnSchema.options.map(stat_name => {
            if (stat_name === C.DURATION) return null
            const stat_value = player.stats[stat_name]
            const stat_value_formatted = stat_name === C.TIME_PLAYED ?
              seconds_to_duration(stat_value) : stat_value.toLocaleString()
            return (
              <td
                key={`${player.uno}_${stat_name}`}
                className={`
                  p-2 min-w-[3rem] cursor-pointer group-hover:bg-orange-300/10
                  ${order.column !== stat_name ? '' :
                    is_choosen_row ? (is_team ? 'text-orange-500' : 'text-orange-600') :
                      is_team ? 'text-orange-300' : ''}`}
                title={t(`open ${C.MATCH} ${C.STATS}`)}
                onClick={() => modal_open(
                  <MatchStatsCard
                    match_body={{
                      game_mode,
                      match_id: player.id,
                      source: match.source,
                      year: YearSchema.parse(new Date(match.time).getFullYear()),
                    }}
                    is_modal={true}
                  />
                )}
              >{stat_value_formatted}</td>
            )
          })}
        </tr >
      )
    })

  const Tbody = () => {
    if (!is_team) {
      return <tbody><PlayersRows players={players} /></tbody>
    }
    return (
      <tbody>
        {match.team.sort((a, b) => {
          let a_count = 0
          let b_count = 0

          if (order.column === C.RESULT) {
            a_count = get_result_count(a.result)
            b_count = get_result_count(b.result)
          } else {
            a_count = a.stats[order.column]
            b_count = b.stats[order.column]
          }

          if (order.is_desc) {
            [a_count, b_count] = [b_count, a_count]
          }
          return a_count - b_count
        }).map((team, index) => {
          const team_rows = [
            <PlayersRows key={`${C.PLAYERS}_${team.name}`} players={team.players} />,
            <TeamSummary key={`${C.TEAM}_${team.name}`} team={team} />,
          ]
          return !is_wz && index ? team_rows.toReversed() : team_rows
        })}
      </tbody>
    )
  }

  return <>
    <title>{`${t(C.MATCH)} ${follow} ${title}`}</title>
    <h4 className="basic-title p-4 text-center text-2xl">{title}</h4>
    <div
      className="text-white rounded-xl bg-fixed bg-contain bg-center"
      style={{
        backgroundImage: `
            linear-gradient(
              180deg,
              rgb(30, 36, 57, 0.6),
              10%,
              rgba(30, 36, 57, 0.8)),
              url('${get_map_img(game_mode, match.map.name)}'
            )`
      }}
    >
      <div>
        <div className="p-4 float-left flex flex-col">
          <div className="basic-title">{t(C.MATCHID)}: {matchID}</div>
          <div className="basic-title">
            <span>{t(C.MAP)}: {format_label_data(match.map)} </span>
            <span>[{format_label_data(match.mode)}]</span>
          </div>
          <div className="basic-title">
            <FormatedTime time={match.time} title={t(C.TIME)} />
          </div>
          <div className="basic-title">
            {t(C.DURATION)}: {match.duration}
          </div>
        </div>

        <div className="p-4 float-right flex flex-col">
          <button
            type="button"
            title={t(`switch sort by ${is_team ? C.TEAM : C.PLAYERS}`)}
            className="link text-amber-500"
            onClick={() => set_params({ team: !is_team })}
          >{t(`sort by ${is_team ? C.TEAM : C.PLAYERS}`)}</button>
        </div>
      </div>

      <table className="text-center font-semibold">
        <Thead />
        <Tbody />
      </table>
    </div>
  </>
}
