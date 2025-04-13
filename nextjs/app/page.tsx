'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import useAppContext from '@/app/components/AppContext'
import MatchesTable from '@/app/components/jsx/MatchesTable'
import { C } from '@/app/components/Consts'
import { is_number } from '@/app/components/UtilsValidators'
import {
  IconAnimatedSpin,
  IconGameMode,
  IconSearch,
} from '@/app/components/Icons'
import {
  get_alert_style,
  get_url,
  date_format,
  router_generate_url,
  fetch_request,
  get_ago_seconds,
} from '@/app/components/UtilsClient'
import {
  ROUTER,
  Router,
  RouterDataType,
  RouterDataTypeSchema,
} from '@/app/components/zod/Router'
import {
  Player,
  PlayerAddSchema,
  PlayerSearchSchema,
  SearchResp,
} from '@/app/components/zod/Player'
import {
  GameModeSchema,
  game_mode_split,
} from '@/app/components/zod/GameMode'
import {
  Platform,
  PlatformOnlySchema,
  Message,
  MessageStatusSchema,
  PlatformSchema,
} from '@/app/components/zod/Main'

export default function Search() {
  const { t } = useAppContext()

  const [platform, setPlatform] = useState<Platform>(C.ACTI)
  const [responses, setResponses] = useState<SearchResp[]>([])
  const [status, setStatus] = useState<React.JSX.Element | null>(null)
  const [searching, setSearching] = useState(false)
  const [router, setRouter] = useState<Router>()
  const [ws, setWs] = useState<WebSocket>()
  const [errorInput, setErrorInput] = useState('')
  const [placeholder, setPlaceholder] = useState('')
  const [dataType, setDataType] = useState<RouterDataType>(RouterDataTypeSchema.options[1])

  const change_platform = (platform: Platform) => {
    setPlatform(platform)
    setResponses([])
    setStatus(null)
    setRouter(undefined)
    setSearching(false)
    setErrorInput('')
    setPlaceholder('')
  }

  if (ws) {
    ws.onmessage = message => {
      try {
        const responses: SearchResp = JSON.parse(message.data)
        setResponses(prev => [responses, ...prev])
      } catch {
        setStatus(<div>{t(message.data)}</div>)
      }
    }

    ws.onclose = () => {
      setStatus(null)
      setSearching(false)
      setPlaceholder('')
    }
  }

  const player_search = async (form_data: FormData) => {
    const target = form_data.get(C.TARGET)?.toString().trim() || null
    const uno = form_data.get(C.UNO)?.toString().trim() || null

    if (platform === 'tracker_search') {
      setRouter({ ...ROUTER, data_type: dataType, target: target || C.TRACKER })
      return
    }

    if (!target) {
      setStatus(
        <div className="p-2">
          {t(`${C.SEARCH} input is empty`)}
        </div>
      )
      setSearching(false)
      return
    }

    if (platform === C.SEARCH && uno && !is_number(uno)) {
      setStatus(
        <div className="message-error">
          {t(`${C.UNO} is incorrect | number expected`)}
        </div>
      )
      return
    }

    const split_tag = target.split('#')
    const no_valid_uno = platform === C.UNO && !is_number(target)
    const not_valid_battle_tag = platform === C.BATTLE && (
      split_tag.length !== 2 ||
      split_tag[0] === '' ||
      split_tag[1] === '' ||
      !is_number(split_tag[1])
    )
    const no_valid_acti_tag = platform === C.ACTI && is_number(target)
    if (no_valid_uno || not_valid_battle_tag || no_valid_acti_tag) {
      setErrorInput(`[${target}] ${t(`${C.NOT_VALID} for ${platform} ${C.PLATFORM}`)} `)
      setPlaceholder('')
      return
    }

    const body = PlayerSearchSchema.parse({ platform, target, uno })

    setSearching(true)

    const res = await fetch_request<SearchResp>('player_pre_check', body)

    if (!res || res.detail) {
      setErrorInput(res?.detail || `get ${C.DATA} ${C.ERROR}`)
      setPlaceholder('')
      setSearching(false)
      return
    }

    setErrorInput('')
    setPlaceholder(body.target)
    setResponses([])
    setStatus(null)

    const { message, result } = res

    if (message === C.NOT_FOUND) {
      const ws_connect = new WebSocket(get_url('player_search', 'ws'))
      ws_connect.onopen = () => ws_connect.send(JSON.stringify(body))
      setWs(ws_connect)
      return
    }

    if (Array.isArray(result)) {
      setResponses(prev => [...result, ...prev])
    } else {
      setResponses(prev => [res, ...prev])
    }

    setSearching(false)
  }

  const RegForm = ({ player }: { player: Player }) => {
    const submit_player = async (form_data: FormData) => {
      const group = form_data.get(C.GROUP)?.toString().trim() || null

      let error: string | undefined

      if (!group) {
        error = `${C.GROUP} ${C.NAME} is empty`
      } else if (is_number(group)) {
        error = `${C.GROUP} ${C.NAME} can\'t be a number [${group}]`
      } else if (group.includes(' ')) {
        error = `${C.GROUP} ${C.NAME} invalid [${group}]`
      }

      if (!group || error) {
        setStatus(prev => <>
          <p className="message-error p-2">
            {t(error)}
          </p>
          {prev}
        </>)
        return
      }

      const body = PlayerAddSchema.parse({ uno: player.uno, group })
      const res = await fetch_request<Message>('player_add', body)

      if (!res || res.detail) {
        setResponses([{
          message: res?.detail || C.ERROR,
          status: MessageStatusSchema.enum.ERROR,
          result: null,
          time: new Date().toISOString()
        }])
      } else {
        player.group = group
        setResponses([{
          message: res.message,
          status: MessageStatusSchema.enum.SUCCESS,
          result: player,
          time: new Date().toISOString()
        }])
      }
    }

    const cancel_form = () => {
      setResponses([])
      setSearching(false)
      setStatus(null)
    }

    return (
      <form className="flex gap-1" action={submit_player}>
        <span className="font-bold">{t(C.GROUP)}: </span>
        <input
          type="text"
          name={C.GROUP}
          list={C.GROUPS}
          placeholder={t(`choose or create ${C.GROUP}`)}
          className="
          pl-2 w-full rounded border border-transparent bg-transparent
          hover:border-sky-500 hover:backdrop-blur focus:backdrop-blur"
          required
        />
        <datalist id={C.GROUPS}></datalist>

        <button
          type="submit"
          className="button-style-1"
          title={t(`click for add ${C.PLAYER}`)}
        >{t('add')}</button>
        <button
          type="button"
          title={t('click for reset')}
          className="button-style-1"
          onClick={cancel_form}
        >{t('cancel')}</button>
      </form>
    )
  }

  const SearchBar = () => useMemo(() => (
    <Fragment>
      <div
        className="
        text-center font-medium leading-tight
        text-3xl mt-0 mb-2 text-teal-600"
      >{t(C.SEARCH)}</div>
      <form className='p-4 flex m-auto min-w-[44rem] max-w-4xl' action={player_search}>
        <label title={t(`select ${C.PLATFORM}`)}>
          <select
            className="p-2 h-full rounded-l bg-white text-gray-500"
            name={C.PLATFORM}
            onChange={e => change_platform(PlatformSchema.parse(e.target.value))}
            disabled={searching}
            value={platform}
          >
            <option value={C.ACTI}>{t(C.ACTI)}</option>
            <option value={C.BATTLE}>{t(C.BATTLE)}</option>
            <option value={C.UNO}>{t(C.UNO)}</option>
            <option value={C.SEARCH}>{t(`find tag by ${C.USERNAME}`)}</option>
            <option value="tracker_search">{t('tracker_search')}</option>
          </select>
        </label>
        {platform === 'tracker_search' && (
          <label title={t(`select ${C.TARGET} type`)}>
            <select
              className="bg-white text-gray-700 px-2 text-center"
              name={C.DATA_TYPE}
              onChange={e => setDataType(RouterDataTypeSchema.parse(e.target.value))}
              value={dataType}
            >
              {RouterDataTypeSchema.options.map(search_type => (
                <option key={search_type} value={search_type}>
                  {t(search_type)}
                </option>
              ))}
            </select>
          </label>
        )}
        <input
          type="text"
          name={C.TARGET}
          placeholder={t(errorInput || `${platform}-sample`)}
          value={placeholder}
          onChange={e => setPlaceholder(e.target.value)}
          className={`
          m-0 relative flex-auto min-w-0 block w-full
          px-3 py-1.5 text-base font-normal
          text-gray-700 bg-clip-padding border border-solid
          border-gray-300 transition ease-in-out
          focus:bg-white focus:border-blue-600 focus:outline-none
          ${errorInput ? 'bg-purple-200 ring-red-500 ring-2' :
              searching ? 'bg-gray-300' : 'bg-green-100'}`}
          disabled={searching}
          autoFocus
          required
        />
        {platform === C.SEARCH && (
          <input
            type="text"
            name={C.UNO}
            placeholder={`${t(C.UNO)} [${t('optional')}]`}
            disabled={searching}
            className="
            relative flex-auto min-w-0 block w-full
            px-3 py-1.5 text-base font-normal
            bg-white text-gray-700 bg-clip-padding border border-solid
            border-gray-300 transition ease-in-out
            m-0 focus:text-gray-700 focus:bg-white
            focus:border-blue-600 focus:outline-none"
          />
        )}
        <button
          type="submit"
          className={`
          button-style-1 rounded-r !p-4
          ${searching ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={t(`${C.SEARCH} ${platform}`)}
          disabled={!placeholder || searching}
        >
          {searching ? <IconAnimatedSpin /> : <IconSearch />}
        </button>
      </form>
    </Fragment>
  ), [platform])

  return <>
    <title>{process.env.APP_NAME}</title>
    <div className="flex flex-col gap-4">
      <SearchBar />

      <div className="flex flex-col gap-2 items-center">{status}</div>
      {responses.map(resp => (
        <MessageCard
          key={resp.time}
          resp={resp}
          RegForm={RegForm}
        />
      ))}

      {!searching && !responses.length && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setRouter(prev => prev ? undefined : ROUTER)}
            className="link text-white"
          >{t(`${router ? 'hide' : 'show'} feed`)}</button>
        </div>
      )}

      {router && <MatchesTable
        key={router.data_type + router.target}
        slug_router={router}
      />}
    </div>
  </>
}

const MessageCard = ({ resp, RegForm }: {
  resp: SearchResp,
  RegForm: ({ player }: { player: Player }) => React.JSX.Element
}) => {
  const { t } = useAppContext()

  if (!resp.result || typeof resp.result === 'string') {
    return (
      <div className={get_alert_style(resp.status)} role="alert">
        <span className="ml-2 float-right font-bold">
          {date_format(resp.time, C.TIME)}
        </span>
        <span>{t(resp.message)}</span>

        {resp.message.includes(C.ALREADY_EXIST) && typeof resp.result === 'string' && (
          <p className="p-2 text-center">
            <Link
              href={router_generate_url({ data_type: C.MATCHES, target: resp.result })}
              className="link text-sky-600"
            >{t(`open ${C.MATCHES}`)}</Link>
          </p>
        )}
      </div>
    )
  }

  if (Array.isArray(resp.result)) return null
  const player = resp.result

  return (
    <div className={`text-left ${get_alert_style(resp.status)}`} role="alert">
      <span className="ml-2 float-right font-bold">
        {date_format(resp.time, C.TIME)}
      </span>

      {resp.status === MessageStatusSchema.enum.SUCCESS && (
        <p className="flex gap-2 justify-center text-lg">
          <span>{t(C.PLAYER)}</span>
          <span className="font-bold">{player.username[0]}</span>
        </p>
      )}

      <div className="flex flex-col">
        {get_ago_seconds(player.time) < 60 && (
          <p className="m-auto">{t('pars_matches_can_take_time')}</p>
        )}
        {Object.entries(player.games)
          .filter(([game_mode, game_status]) => game_mode !== C.MW_WZ && game_status.matches.stats.played)
          .map(([_, game_status]) => {
            const game_mode = GameModeSchema.parse(_)
            const [game, mode] = game_mode_split(game_mode)

            const played_matches = (
              <div
                key={game_mode}
                className="flex gap-2 items-center hover:fill-amber-500 hover:text-amber-500"
              >
                <IconGameMode game_mode={game_mode} />
                <span>{game_status.matches.stats.played} {t(C.MATCHES)}</span>
              </div>
            )

            if (!player.group) return played_matches

            return (
              <Link
                key={game_mode}
                href={router_generate_url({ data_type: C.MATCHES, target: player.uno, game, mode })}
              >{played_matches}</Link>
            )
          })}
      </div>

      {!player.group && (
        <p>
          <span className="font-bold">{t('profile')}: </span>
          {t(resp.status ? 'public' : 'private')}
        </p>
      )}

      {PlatformOnlySchema.options.map(platform => player[platform] && (
        <p key={player[platform] + platform}>
          <span className="font-bold">{t(platform)}: </span>
          {player[platform]}
        </p>
      ))}

      <p>
        <span className="font-bold">{t(C.TIME)}: </span>
        {date_format(player.time, C.DATETIME)}
      </p>

      {player.username?.length > 1 && (
        <p className="max-w-md break-words">
          <span className="font-bold">{t(C.USERNAME)}: </span>
          <span>{player.username.join(', ')}</span>
        </p>
      )}

      {player.clantag?.length > 0 && (
        <p className="max-w-md break-words">
          <span className="font-bold">{t(C.CLANTAG)}: </span>
          <span>{player.clantag.join(', ')}</span>
        </p>
      )}

      {player.group ? (
        <p>
          <span className="font-bold">{t(C.GROUP)}: </span>
          <Link
            className="link text-amber-500"
            href={router_generate_url({ data_type: C.MATCHES, target: player.group })}
          >{player.group}</Link>
        </p>
      ) : resp.status === MessageStatusSchema.enum.SUCCESS && (
        <RegForm player={player} />
      )}

    </div>
  )
}
