'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import useAppContext from '@/app/components/AppContext'
import FormatedTime from '@/app/components/jsx/FormatedTime'
import db_migrate from '@/app/components/drizzle/migrate'
import { usePanelContext } from './navigation'
import { C } from '@/app/components/Consts'
import { IconGameMode } from '@/app/components/Icons'
import {
  fetch_request,
  router_generate_url,
  date_format,
  get_ago,
} from '@/app/components/UtilsClient'
import { UpdateRouterSchema } from '@/app/components/zod/Router'
import {
  GameModeSchema,
  game_mode_split,
  GAME_MODE_TITLES,
  GameModeOnlySchema,
} from '@/app/components/zod/GameMode'
import {
  TaskStatusSchema,
  Task,
} from '@/app/components/zod/Task'
import {
  RequestMethodSchema,
  Message,
} from '@/app/components/zod/Main'
import {
  StatsRow,
  TrackerStats,
  TrackerStatsFullmatchesType,
} from '@/app/components/zod/TrackerStats'
import {
  PanelStatuses,
  BaseStats,
  UpdatePlayers,
  ResetType,
  ResetResponse,
  ClearFullmatchDoublesBody,
  ClearFullmatchesDoublesResponse,
  UpdatePlayersSchema,
  ResetTypeSchema,
} from '@/app/components/zod/Panel'
import { is_game_mode } from '@/app/components/UtilsValidators'

export default function AdminPanel() {
  const { t } = useAppContext()
  const { panel, fetch_data } = usePanelContext()

  if (!panel) return null

  return <>
    <title>{t('panel')}</title>
    <div className="p-4 flex flex-col gap-2">
      {panel.time && (
        <h3 className="basic-title text-center">
          <FormatedTime time={panel.time} title={t('start')} />
        </h3>
      )}
      <StatusButtons panel_statuses={panel.statuses} fetch_data={fetch_data} />
      <TaskQueues task_queues={panel.task_queues} />
      <AllUpdateTable update_players={panel.update_players} />
      <div className="p-4">
        <TrackerStatsTable tracker_stats={panel.tracker_stats} />
        <BaseStatsTable base_stats={panel.base_stats} />
      </div>
      <Resets resets={panel.resets} />
      <ActualizeFullmatches groups={panel.groups} />
      <ClearFullmatchDoubles />
      <form>
        <button
          formAction={db_migrate}
          title="drizzle schema migrate"
          className="button-style-1"
        >drizzle migrate</button>
      </form>
    </div>
  </>
}

const StatusButtons = ({ panel_statuses, fetch_data }: {
  panel_statuses: PanelStatuses,
  fetch_data: () => void
}) => {
  const { t } = useAppContext()

  const [statuses, setStatuses] = useState(panel_statuses)
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    setStatuses(panel_statuses)
  }, [panel_statuses])

  const change_status = async (status_name: keyof PanelStatuses) => {
    setFetching(true)
    const res = await fetch_request<ResetResponse>(
      `reset/${status_name}`
    )
    if (!res || res.detail || status_name == C.STATUS) {
      fetch_data()
    } else {
      setStatuses(prev => ({
        ...prev,
        [status_name]: !prev[status_name]
      }))
    }
    setFetching(false)
  }

  const buttons = Object.entries(statuses).map(([_, status]) => {
    const name = _ as keyof PanelStatuses
    const color =
      status === false || status === C.INACTIVE ? 'text-red-400' :
        status === true || status === C.ACTIVE ? 'text-green-400' :
          'text-yellow-400'

    return (
      <button
        key={name}
        type="button"
        title={t(`${name} ${status}`)}
        className="button-style-1 first:rounded-l"
        onClick={() => change_status(name)}
        disabled={fetching}
      >
        <span className={`font-semibold ${color}`} >
          {t(name.split('_').join(' '))}
        </span>
      </button>
    )
  })

  return (
    <div className="flex justify-center sticky top-1 z-[5]">
      {buttons}
      <button
        type="button"
        className="button-style-1 last:rounded-r"
        onClick={fetch_data}
        disabled={fetching}
      >{t(C.REFRESH)}</button>
    </div>
  )
}

const Resets = ({ resets }: { resets: ResetType[] }) => {
  const { t } = useAppContext()

  const [fetching, setFetching] = useState(false)
  const [status, setStatus] = useState<React.JSX.Element | null>(null)

  const reset = async (form_data: FormData) => {
    const reset = ResetTypeSchema.safeParse(form_data.get(C.NAME))

    if (!reset.success) {
      setStatus(
        <span className="message-error">
          {t(`please enter reset ${C.NAME}`)}
        </span>
      )
      return
    }

    setFetching(true)
    const res = await fetch_request<ResetResponse>(`reset/${reset.data}`)
    setFetching(false)

    if (!res || res.detail) {
      setStatus(
        <span className="message-error">
          {t(res?.detail || `reset ${C.ERROR}`)}
        </span>
      )
    } else {
      setStatus(
        <span className="message-success">
          {t(C.TIME_TAKEN)}: {res.time_taken}
        </span>
      )
    }
  }

  return (
    <form className="inline-flex" action={reset}>
      <button
        className="button-style-1 rounded-l"
        title={t('reset')}
        disabled={fetching}
      >{t('reset')}</button>
      <label title={t('select reset option')}>
        <select
          name={C.NAME}
          className="rounded-r text-center bg-white"
        >
          <option value="">
            {fetching ? `${t('resetting')}...` : t('choose_an_option')}
          </option>
          {resets.map(name => (
            <option key={name} value={name}>
              {t(name)}
            </option>
          ))}
        </select>
      </label>
      <span className="ml-2">{status}</span>
    </form>
  )
}

const ActualizeFullmatches = ({ groups }: { groups: string[] }) => {
  const { t } = useAppContext()
  const [status, setStatus] = useState<React.JSX.Element | null>(null)
  const [fetching, setFetching] = useState(false)

  const start_actualize = async (form_data: FormData) => {
    const mode = form_data.get(C.MODE)
    const uno = form_data.get(C.UNO)

    const update_router = UpdateRouterSchema.parse({
      data_type: C.FULLMATCHES_PARS,
      uno,
      game_mode: `${C.MW}_${mode}`,
    })
    setFetching(true)
    const res = await fetch_request<Message>('update_router', update_router)
    setFetching(false)
    setStatus(
      <span className={res?.message ? 'message-success' : 'message-error'}>
        {t(res?.message || res?.detail || `${C.DATA} ${C.NOT_FOUND}`)}
      </span>
    )
  }

  return (
    <form className="inline-flex" action={start_actualize}>
      <button
        type="submit"
        className="button-style-1 rounded-l"
        title={t('start actualize')}
        disabled={fetching}
      >{t(`actualize ${C.FULLMATCHES}`)}</button>
      <label title={t(`choose ${C.MODE}`)}>
        <select
          name={C.MODE}
          className="text-center text-gray-500 bg-white"
        >
          <option value={C.WZ}>{t(C.WZ)}</option>
          <option value={C.MP}>{t(C.MP)}</option>
        </select>
      </label>
      <label title={t(`choose ${C.GROUP}`)}>
        <select
          name={C.UNO}
          className="text-center text-gray-500 bg-white rounded-r"
        >
          {groups.map(group => <option key={group} value={group}>{group}</option>)}
        </select>
      </label>
      <span className="ml-2">{status}</span>
    </form>
  )
}

const ClearFullmatchDoubles = () => {
  const { t } = useAppContext()

  const [status, setStatus] = useState<React.JSX.Element | null>(null)
  const [fetching, setFetching] = useState(false)

  const send_body = async (form_data: FormData) => {
    const game_mode = GameModeSchema.parse(form_data.get(C.GAME_MODE))
    const matchID = form_data.get(C.MATCHID)?.toString().trim() || null

    if (!matchID) {
      setStatus(
        <span className="message-error">
          {t(`${C.MATCHID} ${C.NOT_FOUND}`)}
        </span>
      )
      return
    }

    const body: ClearFullmatchDoublesBody = { game_mode, matchID }

    setFetching(true)
    const res = await fetch_request<ClearFullmatchesDoublesResponse>(
      'clear_fullmatches_doubles', body
    )
    setFetching(false)

    if (!res || res.detail) {
      setStatus(
        <span className="message-error">
          {res?.detail || C.ERROR}
        </span>
      )
      return
    }

    setStatus(
      <span className="message-success dropdown">
        {res.message}
        <span className="popUp">
          {res.result.map(deleted => (
            <p key={deleted.uno}>{deleted.uno} {deleted.username}</p>
          ))}
        </span>
      </span>
    )
  }

  return <>
    <form className="flex" action={send_body}>
      <button
        type="submit"
        title={t('start clean doubles')}
        className="button-style-1 rounded-l"
        disabled={fetching}
      >{t('clear fullmatch doubles')}</button>
      <label title={t(`choose ${C.GAME_MODE}`)}>
        <select
          name={C.GAME_MODE}
          className="text-center text-gray-500 bg-white"
        >
          <option value={C.MW_WZ}>{t(C.MW_WZ)}</option>
          <option value={C.MW_MP}>{t(C.MW_MP)}</option>
        </select>
      </label>
      <input
        type="text"
        name={C.MATCHID}
        title={t(`${C.MATCH} ${C.ID}`)}
        placeholder={t(C.MATCHID)}
        className="input-style-1 rounded-r"
        required
      />
    </form>
    <span className="ml-2">{status}</span>
  </>
}

const TaskQueues = ({ task_queues = [] }: { task_queues: Task[] }) => {
  const { t } = useAppContext()
  const [fetching, setFetching] = useState(false)
  const [tasks, setTasks] = useState(task_queues)
  const [status, setStatus] = useState<React.JSX.Element | null>(null)

  useEffect(() => {
    setTasks(task_queues)
  }, [task_queues])

  if (!tasks.length) return null

  const task_queues_delete_all = async () => {
    setFetching(true)
    const res = await fetch_request<ResetResponse>(`reset/${C.TASK_QUEUES}`)
    if (res?.time_taken) {
      setTasks([])
      setStatus(
        <span className="message-success">
          {t(`${C.TASK_QUEUES} was reset`)}
          {t(C.TIME_TAKEN)}: {res.time_taken}
        </span>
      )
    } else {
      setStatus(
        <span className="message-error">
          {t(res?.detail || `${C.DELETE} ${C.TASK_QUEUES} ${C.ERROR}`)}
        </span>
      )
    }
    setFetching(false)
  }

  const task_queues_delete = async (name: string) => {
    setFetching(true)
    const del_task = await fetch_request<Message>(
      `task_queues/${name}`, undefined, RequestMethodSchema.enum.DELETE
    )
    if (del_task?.message) {
      setTasks(prev => prev.filter(tasks => tasks.name !== name))
      setStatus(
        <span className="message-success">
          {t(del_task.message)}
        </span>
      )
    } else {
      setStatus(
        <span className="message-error">
          {t(del_task?.detail || `${C.DELETE} [${name}] ${C.ERROR}`)}
        </span>
      )
    }
    setFetching(false)
  }

  const ShowTask = ({ task, index }: { task: Task, index: number }) => {
    const status_color = task.status === TaskStatusSchema.enum.PENDING ? 'text-yellow-500' :
      task.status === TaskStatusSchema.enum.RUNNING ? 'text-green-500' :
        task.status === TaskStatusSchema.enum.ERROR ? 'text-red-500' :
          'text-white'

    const TaskData = () => (
      <div className="dropdown">
        {t(task.name)}
        <div className="popUp text-center">
          <h3 className="basic-title">{t(C.DATA)}</h3>
          <p>{task.uno} {task.game_mode} {task.data_type}</p>
          <table>
            <thead>
              <tr>
                <th>{t(C.NAME)}</th>
                <th>{t(C.VALUE)}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(task.data).map(([name, value]) => (
                <tr key={`${task.name}_${name}`}>
                  <td>{name}</td>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )

    return (
      <tr>
        <td>{index}</td>
        <td><TaskData /></td>
        <td><span className={status_color}>{t(task.status)}</span></td>
        <td>{task.time && <FormatedTime time={task.time} />}</td>
        <td>{task.time_started && <FormatedTime time={task.time_started} />}</td>
        <td>{task.time_end && <FormatedTime time={task.time_end} />}</td>
        <td>
          <button
            type="button"
            className={`disabled:opacity-75 ${task.status !== TaskStatusSchema.enum.PENDING ? 'text-gray-500' : 'text-red-500'}`}
            onClick={() => task_queues_delete(task.name)}
            disabled={task.status !== TaskStatusSchema.enum.PENDING || fetching}
          >✘</button>
        </td>
      </tr>
    )
  }

  return <>
    <h3 className="text-center basic-title">{t(C.TASK_QUEUES)}</h3>
    <div className="p-2 text-center">{status}</div>
    <table className="table_logs">
      <thead>
        <tr>
          <th>#</th>
          <th>{t(C.NAME)}</th>
          <th>{t(C.STATUS)}</th>
          <th>{t(`${C.TIME} created`)}</th>
          <th>{t(`${C.TIME} started`)}</th>
          <th>{t(`${C.TIME} end`)}</th>
          <th>
            <button
              type="button"
              className="text-red-500 hover:text-500/70 disabled:opacity-75"
              title={t(`clean ${C.TASK_QUEUES}`)}
              onClick={task_queues_delete_all}
              disabled={fetching}
            >{t(C.DELETE)}</button>
          </th>
        </tr>
      </thead>
      <tbody>{tasks.map((task, index) => <ShowTask key={task.name} task={task} index={index} />)}</tbody>
    </table>
  </>
}

const StatsRowShow = ({ stats_row }: { stats_row: StatsRow }) => (
  <span className={`dropdown ${!stats_row.rows ? 'opacity-60' : ''}`}>
    {stats_row.rows.toLocaleString()}
    {stats_row.last_id > 0 && (
      <span className="popUp">
        last {C.ID} {stats_row.last_id.toLocaleString()}
      </span>
    )}
  </span>
)

const TrackerStatsTable = ({ tracker_stats }: { tracker_stats: TrackerStats }) => {
  const { t } = useAppContext()

  const { data, time } = tracker_stats

  const FullmatchesStats = ({ source, data }: {
    source: C.MAIN | C.BASIC, data: TrackerStatsFullmatchesType
  }) => (
    <tr>
      <th className="text-left">{t(`${source} ${C.FULLMATCHES}`)}</th>
      {GameModeSchema.options.map(game_mode => {
        const key = `${C.FULLMATCHES}_${source}_${game_mode}`
        if (game_mode === C.MW_WZ) {
          const stats_rows = data[game_mode]
          if (stats_rows.all.rows > 0) {
            return (
              <th key={key} title={GAME_MODE_TITLES[game_mode]}>
                {Object.entries(stats_rows).map(([name, stats_row]) => (
                  <p
                    key={`${key}_${name}`}
                    className="dropdown text-left"
                  >
                    {name}: <StatsRowShow stats_row={stats_row} />
                  </p>
                ))}
              </th>
            )
          }
          return (
            <th key={key}><StatsRowShow stats_row={stats_rows.all} /></th>
          )
        }

        return (
          <th key={key}><StatsRowShow stats_row={data[game_mode]} /></th>
        )
      })}
    </tr>
  )

  return <>
    <table className="table_logs inline-block align-top">
      <thead>
        <tr>
          <th className="dropdown">
            {t(`${C.GAME} ${C.MATCHES} ${C.STATS}`)}
            <span className="popUp flex flex-col justify-center">
              <span>{date_format(time)}</span>
              <span>{get_ago(time)}</span>
            </span>
          </th>
          {GameModeSchema.options.map(game_mode => (
            <th key={game_mode}>
              <IconGameMode game_mode={game_mode} size={18} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          <th className="text-left">{t(C.MATCHES)}</th>
          {GameModeSchema.options.map(game_mode => (
            <th
              key={`${C.MATCHES}_${game_mode}`}
              title={GAME_MODE_TITLES[game_mode]}
            >
              <StatsRowShow stats_row={data.matches[game_mode]} />
            </th>
          ))}
        </tr>

        <FullmatchesStats source={C.MAIN} data={data.fullmatches_main} />

        <FullmatchesStats source={C.BASIC} data={data.fullmatches_basic} />

        <tr>
          <th>{t(C.SUMMARY)}</th>
          {GameModeSchema.options.map(game_mode => (
            <th key={game_mode} title={GAME_MODE_TITLES[game_mode]}>
              {data.summary[game_mode].toLocaleString()}
            </th>
          ))}
        </tr>
      </tbody>
    </table>

    {data.non_matches && (
      <table className="table_logs inline-block align-top">
        <thead>
          <tr>
            <th>{t(`non ${C.MATCHES} tables`)}</th>
            <th>{t(C.ROWS)}</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data.non_matches).map(([table_name, stats_row]) => (
            <tr key={table_name}>
              <th className="text-left">{table_name}</th>
              <th><StatsRowShow stats_row={stats_row} /></th>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </>
}

const BaseStatsTable = ({ base_stats }: { base_stats: BaseStats }) => {
  const { t } = useAppContext()

  return (
    <table className="table_logs inline-block align-top">
      <thead>
        <tr>
          <th className="dropdown">
            {t(`${C.BASE} tables`)}
            <span className="popUp flex flex-col justify-center">
              <span>{date_format(base_stats.time)}</span>
              <span>{get_ago(base_stats.time)}</span>
            </span>
          </th>
          <th>{t(C.ROWS)}</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(base_stats.data).map(([table_name, stats_row]) => (
          <tr key={table_name}>
            <th className="text-left">{table_name}</th>
            <th><StatsRowShow stats_row={stats_row} /></th>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const AllUpdateTable = ({ update_players }: { update_players: UpdatePlayers[] }) => {
  const { t } = useAppContext()
  const [players, setPlayers] = useState<UpdatePlayers[]>([])

  useEffect(() => {
    setPlayers(update_players)
  }, [update_players])

  if (!players.length) return null

  const clean_update_players = async () => {
    const res = await fetch_request<ResetResponse>(`reset/${C.UPDATE_PLAYERS}`)
    if (res?.time_taken) {
      setPlayers([])
    }
  }

  const PlayerRow = ({ player }: { player: UpdatePlayers }) => {
    const update_statuses: (string | number)[] = []

    const player_games = GameModeOnlySchema.options.map(game_mode => {
      const [game, mode] = game_mode_split(game_mode)

      const update_status = player[game_mode]
      update_statuses.push(update_status)

      const status = update_status === C.NOT_FOUND ? '✘' :
        typeof update_status === 'number' ? (
          <span className="text-green-500">
            {update_status}
          </span>
        ) : typeof update_status === 'string' ?
          t(update_status) : update_status

      return (
        <th key={`${player.uno}_${game_mode}`}>
          <Link
            href={router_generate_url({ data_type: C.MATCHES, target: player.uno, game, mode })}
            className="link text-amber-500"
          >{status}</Link>
        </th>
      )
    })

    const is_done = update_statuses.every(game => game !== TaskStatusSchema.enum.PENDING)

    return (
      <tr key={player.uno} className={is_done ? 'text-green-500' : ''}>
        <th>{player.uno}</th>
        <th>{player.player}</th>
        <th>{player.group}</th>
        {player_games}
      </tr>
    )
  }

  return <>
    <h3 className="basic-title">
      {t(C.UPDATE_PLAYERS)}
      <button
        type="button"
        className="text-red-500 text-lg"
        title={t(`clean ${C.UPDATE_PLAYERS}`)}
        onClick={clean_update_players}
      >✘</button>
    </h3>
    <table className="table_logs w-96">
      <thead>
        <tr>
          {UpdatePlayersSchema.keyof().options.map(key => (
            <th key={key}>
              {is_game_mode(key) ? (
                <IconGameMode key={key} game_mode={key} />
              ) : (
                t(key)
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {players.map(player => <PlayerRow key={player.uno} player={player} />)}
      </tbody>
    </table>
  </>
}
