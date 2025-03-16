'use client'

import {
  C,
  TIME_LOAD_DELAY
} from '@/app/components/Consts'
import {
  PROFILE,
  UserProfile,
} from '@/app/components/zod/User'
import { PlayerData } from '@/app/components/zod/Player'
import { GroupData } from '@/app/components/zod/Group'
import {
  Router,
  RouterDataTypeSchema,
  RouterDateSchema,
  RouterOrderAllSchema,
  RouterGenerateUrl,
  ROUTER,
  RouterGenerateUrlSchema,
  ContextMatchesStatsNavigationDataType,
} from '@/app/components/zod/Router'
import {
  game_mode_split,
  GameMode,
  GameModeOnly,
  GameSchema,
  ModeSchema,
} from '@/app/components/zod/GameMode'
import {
  target_data_get,
  target_unos_get,
} from '@/app/components/UtilsTracker'
import {
  Alert,
  AlertColor,
  RequestMethod,
  RequestMethodSchema,
  Status,
  MessageStatus,
  MessageStatusSchema,
  TimeType,
} from '@/app/components/zod/Main'
import {
  GroupUno,
  PlayerUno,
  Uno,
} from '@/app/components/zod/Uno'
import { validate_game_mode } from '@/app/components/UtilsValidators'
import { LabelData } from '@/app/components/zod/Label'
import {
  Language,
  LanguageSchema,
  TranslatesStore,
} from '@/app/components/zod/Language'
import { MatchResultMpSchema } from '@/app/components/zod/Match'

export const get_alert_style = (status: MessageStatus) => {
  const alert_colors: Record<MessageStatus, AlertColor> = {
    [MessageStatusSchema.enum.ERROR]: 'bg-red-100 text-red-700',
    [MessageStatusSchema.enum.SUCCESS]: 'bg-green-100 text-green-700',
    [MessageStatusSchema.enum.MESSAGE]: 'bg-blue-100 text-blue-700',
    [MessageStatusSchema.enum.ALERT]: 'bg-yellow-100 text-yellow-700'
  }
  const color = alert_colors[status]
  const alert_style: Alert = `p-4 rounded-lg ${color}`

  return alert_style
}

export function local_profile_manage(): UserProfile
export function local_profile_manage(user_profile: UserProfile): void
export function local_profile_manage(user_profile?: UserProfile) {
  if (user_profile) {
    local_storage('profile', 'set', user_profile)
    return
  }

  return local_storage('profile') || {
    ...PROFILE,
    time: typeof window !== 'object' ? '' : new Date().toISOString()
  }
}

export async function translate_get() {
  const stored_translate = local_storage(C.TRANSLATE)

  if (!stored_translate) {
    const res = await fetch_request<TranslatesStore>('translate_store')

    if (!res || res.detail) return

    local_storage(C.TRANSLATE, 'set', res)

    return res
  }

  const [version_epoch_time, user_version] = stored_translate.version.split('_')
  const date_epoch_now = date_epoch(new Date())

  const updated_ago_seconds = date_epoch_now - +version_epoch_time
  const week_seconds = 60 * 60 * 24 * 7
  if (updated_ago_seconds < week_seconds) {
    return stored_translate
  }

  // check for actual version
  const version_check = await fetch_request<Status>(`translate_version_check/${user_version}`)
  if (version_check?.status) {
    // update version_epoch_time
    stored_translate.version = `${date_epoch_now}_${user_version}`
    local_storage(C.TRANSLATE, 'set', stored_translate)
    return stored_translate
  }
}

export type LocalStorageTarget = C.TRANSLATE | 'profile'

export function local_storage(name: 'profile'): UserProfile | undefined
export function local_storage(name: 'profile', action: 'set', value: UserProfile): void

export function local_storage(name: C.TRANSLATE): TranslatesStore | undefined
export function local_storage(name: C.TRANSLATE, action: 'set', value: TranslatesStore): void

export function local_storage(name: LocalStorageTarget, action: 'clear'): void
export function local_storage(name: LocalStorageTarget, action: 'remove'): void
export function local_storage(
  name: LocalStorageTarget,
  action: 'get' | 'set' | 'clear' | 'remove' = 'get',
  value: string | object = '',
): object | undefined {

  if (typeof window !== 'object') return

  if (action === 'get') {
    const val = window.localStorage.getItem(name)
    if (val) {
      return JSON.parse(val)
    }
  }

  if (action === 'set') {
    if (typeof value === 'object') {
      value = JSON.stringify(value)
    }
    window.localStorage.setItem(name, value)

  } else if (action === 'remove') {
    window.localStorage.removeItem(name)

  } else if (action === 'clear') {
    window.localStorage.clear()
  }
}

export const router_generate = (slugs: string[]): Router => {
  const router = { ...ROUTER }

  if (slugs[0] === C.ALL) {
    router.target = slugs.shift()!
  }

  for (const slug of slugs) {
    const is_data_type = RouterDataTypeSchema.safeParse(slug)
    if (is_data_type.success) {
      router.data_type = is_data_type.data
      continue
    }

    const is_game = GameSchema.safeParse(slug)
    if (is_game.success) {
      router.game = is_game.data
      continue
    }

    const is_mode = ModeSchema.safeParse(slug)
    if (is_mode.success) {
      router.mode = is_mode.data
      continue
    }

    const is_order = RouterOrderAllSchema.safeParse(slug)
    if (is_order.success) {
      router.order = is_order.data
      continue
    }

    const is_date = RouterDateSchema.safeParse(slug)
    if (is_date.success) {
      router.date = is_date.data
      continue
    }

    router.target = decodeURIComponent(slug)
  }

  router.game_mode = validate_game_mode(`${router.game}_${router.mode}`)

  return router
}

export const router_generate_url = (router: RouterGenerateUrl) => {
  const { data_type, target, game, mode, order, date } = RouterGenerateUrlSchema.parse(router)

  const path = data_type === C.STATS ? C.STATS : C.MATCHES
  const slugs: [ContextMatchesStatsNavigationDataType, ...string[]] = [path]

  if (target !== C.TRACKER) {
    slugs.push(target)
  }

  if (game && game !== C.ALL) {
    slugs.push(game)
  }

  if (mode && mode !== C.ALL && game === C.MW) {
    slugs.push(mode)
  }

  if (data_type === C.USERNAME || data_type === C.CLANTAG) {
    slugs.push(data_type)
  }

  if (order && order !== '-time') {
    slugs.push(order)
  }

  if (date) {
    slugs.push(date)
  }

  return `/${slugs.join('/')}`
}

export const encode = (text: string) => Buffer.from(text, 'binary').toString('base64')
export const decode = (text: string) => Buffer.from(text, 'base64').toString('binary')

export const get_url = (
  path: string,
  url_type: 'default' | 'ws' | 'img' = 'default',
  api_version: 'fastapi' | 'nextjs' = 'fastapi'
) => {

  const api_path =
    api_version === 'fastapi' ? process.env.FASTAPI_API_PATH! :
      api_version === 'nextjs' ? process.env.NEXTJS_API_PATH! :
        ''

  switch (url_type) {
    case 'default':
      path = `${api_path}/${path}`
      break
    case 'ws':
      path = `${api_path}/${url_type}/${path}`
      break
    case 'img':
      path = `/map/${path}`
      break
    default:
      throw new Error(`Invalid name parameter: ${url_type}`)
  }

  if (api_version === 'nextjs') return path

  let hostname = sessionStorage.getItem('hostname')
  if (!hostname) {
    const STATIC_IPS: string[] = JSON.parse(process.env.STATIC_IPS!)
    hostname = STATIC_IPS[0] || STATIC_IPS[1] || 'localhost'
    sessionStorage.setItem('hostname', hostname)
  }

  const protocol = url_type === 'ws' ? `${url_type}:` :
    typeof window === 'object' ? window.location.protocol : 'http:'

  const url = `${protocol}//${hostname}${path}`

  return url
}

export async function fetch_request<T>(
  path: string,
  body?: object | FormData,
  method?: RequestMethod,
  api_version: 'fastapi' | 'nextjs' = 'fastapi'
) {
  let data: T & { detail?: string } | undefined

  const options: RequestInit = {
    method: method ? method : body ? RequestMethodSchema.enum.POST : RequestMethodSchema.enum.GET,
    body: body && JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      token: local_profile_manage().token,
    },
  }

  try {
    const url = get_url(path, 'default', api_version)
    const res = await fetch(url, options)
    data = await res.json()

    const INVALID_TOKENS = [
      `expired ${C.TOKEN}`, `invalid ${C.TOKEN}`, `${C.USER} ${C.NOT_FOUND}`
    ]
    if (INVALID_TOKENS.includes(data?.detail || '')) {
      local_profile_manage(PROFILE)
      if (typeof window !== 'undefined') {
        await new Promise(r => setTimeout(r, TIME_LOAD_DELAY))
        window.location.reload()
      }
    }
  } catch {
    if (typeof sessionStorage === 'undefined') return
    const hostname = sessionStorage.getItem('hostname')
    if (hostname && typeof window === 'object' && window.location.hostname !== hostname) {
      sessionStorage.setItem('hostname', window.location.hostname)
      try {
        const res = await fetch(get_url(path), options)
        data = await res.json()
      } catch {
        console.log(`${C.ERROR} ${window.location.hostname}, set back hostname ${hostname}`)
        sessionStorage.setItem('hostname', hostname)
      }
    }
  }

  return data
}

export const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

export const string_to_local_date = (date_iso: string): Date => {
  const date = new Date(date_iso)
  const offset = date.getTimezoneOffset() * 60 * 1000
  const local_date = new Date(date.getTime() - offset)
  return local_date
}

export const date_format = (
  given_date: Date | string | number,
  strf: C.ISO | C.EPOCH | C.TIME | C.DATE | C.DATETIME = C.DATETIME
): string => {
  let date: Date

  if (!given_date) return `Invalid ${C.DATE}`

  if (typeof given_date === 'string') {
    date = new Date(given_date)
  } else if (typeof given_date === 'number') {
    date = new Date(given_date * 1000)
  } else if (typeof given_date === 'object') {
    date = given_date
  } else {
    date = new Date()
  }

  let formated_date = ''

  const options: Intl.DateTimeFormatOptions = {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  }

  if (strf === undefined) {
  } else if (strf === C.ISO) {
    formated_date = date.toISOString()
  } else if (strf === C.EPOCH) {
    formated_date = date_epoch(date).toString()
  } else if (strf === C.TIME) {
    formated_date = date.toLocaleString(local_profile_manage().language).split(',')[1].split(' ')[1]
  } else if (strf === C.DATE) {
    options.month = 'short'
    options.day = 'numeric'
    options.year = 'numeric'
    formated_date = date.toLocaleString(local_profile_manage().language, options)
  } else if (strf === C.DATETIME) {
    formated_date = date.toLocaleString(local_profile_manage().language, options)
  } else {
    formated_date = `Invalid ${C.DATE}`
  }

  return formated_date
}

export const seconds_to_time = (all_seconds: number): string => {
  const all_minutes = Math.floor(all_seconds / 60)
  const hours = Math.floor(all_minutes / 60).toString().padStart(2, '0')
  const minutes = all_minutes % 60
  const seconds = all_seconds % 60

  return `${hours}:${minutes}:${seconds}`
}

export const seconds_to_duration = (seconds: number): string => {
  if (!seconds) return '00:00'
  const duration = new Date((seconds) * 1000)
  const dates = [duration.getUTCHours(), duration.getUTCMinutes(), duration.getSeconds()]
  const [h, m, s] = dates.map(date => date.toString().padStart(2, '0'))
  if (h == '00') {
    return `${m}:${s}`
  }
  return `${h}:${m}:${s}`
}

export const get_ago_seconds = (date?: Date | string): number => {
  if (!date) return 0
  if (typeof date === 'string') {
    date = string_to_local_date(date)
  }

  const now = new Date().getTime()
  const seconds_ago = Math.floor((now - date.getTime()) / 1000)

  return seconds_ago
}

export const date_epoch = (date: Date) => Math.round(date.getTime() / 1000)

const ht = (value: number, time_type: TimeType, language: Language) => {
  let humanized_time = `${value} `

  if (language === C.RU) {
    const ru_types: Record<TimeType, string[]> = {
      second: ['секунда', 'секунды', 'секунд'],
      minute: ['минута', 'минуты', 'минут'],
      hour: ['час', 'часа', 'часов'],
      day: ['день', 'дня', 'дней'],
      week: ['неделя', 'недели', 'недель'],
      month: ['месяц', 'месяца', 'месяцев'],
      year: ['год', 'года', 'лет']
    }
    const ru_num = () => {
      const val = Math.abs(value) % 100
      const num = val % 10
      if (val > 10 && val < 20) return 2
      if (num > 1 && num < 5) return 1
      if (num === 1) return 0
      return 2
    }

    humanized_time += ru_types[time_type][ru_num()]
  } else {
    humanized_time += time_type + (value > 1 ? 's' : '')
  }

  return humanized_time
}

export const format_seconds_ago = (seconds_ago: number, language: Language): string => {
  const delimeter = language === C.RU ? 'и' : 'and'

  if (seconds_ago < 60) {
    return ht(seconds_ago, 'second', language)
  }

  const minutes = Math.floor(seconds_ago / 60)
  if (minutes < 60) {
    const m = ht(minutes, 'minute', language)
    const s_rem = seconds_ago % 60
    if (s_rem) {
      const s = ht(s_rem, 'second', language)
      return `${m} ${delimeter} ${s}`
    }
    return m
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const h = ht(hours, 'hour', language)
    const m_rem = minutes % 60
    if (m_rem) {
      const m = ht(m_rem, 'minute', language)
      return `${h} ${delimeter} ${m}`
    }
    return h
  }

  const days = Math.floor(hours / 24)
  if (days < 7) {
    const d = ht(days, 'day', language)
    const h_rem = hours % 24
    if (h_rem) {
      const h = ht(h_rem, 'hour', language)
      return `${d} ${delimeter} ${h}`
    }
    return d
  }

  const weeks = Math.floor(days / 7)
  if (weeks < 4) {
    const w = ht(weeks, 'week', language)
    const d_rem = days % 7
    if (d_rem) {
      const d = ht(d_rem, 'day', language)
      return `${w} ${delimeter} ${d}`
    }
    return w
  }

  const months = Math.floor(weeks / 4)
  if (months < 12) {
    const m = ht(months, 'month', language)
    const w_rem = weeks % 4
    if (w_rem) {
      const w = ht(w_rem, 'week', language)
      return `${m} ${delimeter} ${w}`
    }
    return m
  }

  const years = Math.floor(months / 12)
  const y = ht(years, C.YEAR, language)
  const m_rem = months % 12
  if (m_rem) {
    const m = ht(m_rem, 'month', language)
    return `${y} ${delimeter} ${m}`
  }
  return y
}

export const get_ago = (date: Date | string | number | null | undefined): string => {
  const language = local_profile_manage().language
  const is_ru = language === C.RU

  if (!date || date === 'no date') {
    if (is_ru) return 'нет даты'
    return 'no date'
  }

  if (typeof date === 'string') {
    date = string_to_local_date(date)
  } else if (typeof date === 'number') {
    date = new Date(date * 1000)
  }

  const seconds_ago = get_ago_seconds(date)

  if (seconds_ago < -3) {
    return date_format(date)
  }

  if (seconds_ago < 3) {
    return is_ru ? 'Сейчас' : 'Now'
  }

  const humanized_time = format_seconds_ago(seconds_ago, language)

  return `${humanized_time} ${is_ru ? 'назад' : 'ago'}`
}

export const get_result_color = (
  result: number,
  game_mode: GameModeOnly,
  color_type: 'text' | 'bg' | 'border' | 'from',
) => {
  const RESULT_COLORS = {
    [C.MP]: {
      text: {
        [MatchResultMpSchema.enum.DRAW]: 'text-gray-500/60',
        [MatchResultMpSchema.enum.WIN]: 'text-green-400/60',
        [MatchResultMpSchema.enum.LOSS]: 'text-red-400/60',
      },
      bg: {
        [MatchResultMpSchema.enum.DRAW]: 'bg-gray-400/30',
        [MatchResultMpSchema.enum.WIN]: 'bg-green-600/30',
        [MatchResultMpSchema.enum.LOSS]: 'bg-red-600/30',
      },
      border: {
        [MatchResultMpSchema.enum.DRAW]: 'border-gray-500/60',
        [MatchResultMpSchema.enum.WIN]: 'border-green-500/60',
        [MatchResultMpSchema.enum.LOSS]: 'border-red-500/60',
      },
      from: {
        [MatchResultMpSchema.enum.DRAW]: 'from-gray-500/30',
        [MatchResultMpSchema.enum.WIN]: 'from-green-500/30',
        [MatchResultMpSchema.enum.LOSS]: 'from-red-500/30',
      },
    },
    [C.WZ]: {
      text: {
        0: 'bg-gray-400',

        1: 'text-green-400',
        2: 'text-green-400/90',
        3: 'text-green-400/80',

        4: 'text-teal-400/70',
        5: 'text-teal-400/70',
        6: 'text-teal-400/70',

        7: 'text-red-500/70',
        8: 'text-red-500/70',

        9: 'text-red-500/80',
        10: 'text-red-500/80',

        11: 'text-red-500/90',
        12: 'text-red-500/90',
      },
      bg: {
        0: 'bg-gray-400/30',

        1: 'bg-green-600/40',
        2: 'bg-green-600/30',
        3: 'bg-green-600/20',

        4: 'bg-gray-500/40',
        5: 'bg-gray-500/40',
        6: 'bg-gray-500/40',

        7: 'bg-red-500/20',
        8: 'bg-red-500/20',

        9: 'bg-red-500/30',
        10: 'bg-red-500/30',

        11: 'bg-red-500/40',
        12: 'bg-red-600/40',
      },
      border: {
        0: 'border-gray-500/60',

        1: 'border-green-500/90',
        2: 'border-green-500/70',
        3: 'border-green-500/50',

        4: 'border-teal-500/90',
        5: 'border-teal-500/70',
        6: 'border-teal-500/50',

        7: 'border-red-500/40',
        8: 'border-red-500/40',

        9: 'border-red-500/50',
        10: 'border-red-500/50',

        11: 'border-red-500/60',
        12: 'border-red-500/60',
      },
      from: {
        0: 'from-gray-500/30',

        1: 'from-green-500/20',
        2: 'from-green-500/20',
        3: 'from-green-500/10',

        4: 'from-teal-500/30',
        5: 'from-teal-500/20',
        6: 'from-teal-500/10',

        7: 'from-red-500/10',
        8: 'from-red-500/10',

        9: 'from-red-500/20',
        10: 'from-red-500/20',

        11: 'from-red-500/30',
        12: 'from-red-500/30',
      }
    }
  } as const
  const [, mode] = game_mode_split(game_mode)

  if (result in RESULT_COLORS[mode][color_type]) {
    return RESULT_COLORS[mode][color_type][result as 1]
  }

  return RESULT_COLORS[C.MP][color_type][MatchResultMpSchema.enum.LOSS]
}

export const get_map_img = (game_mode: GameMode, map_name: string, table?: boolean) => {
  map_name = map_name.replace(/\s|'|-|_rm/g, '')
  const size = table ? 'table_thumb' : 'full'
  const map_image_url = get_url(`${game_mode}/${map_name}/${size}.webp`, 'img')
  return map_image_url
}

export const get_user_language = () => {
  if (typeof window !== 'object') {
    return LanguageSchema.options[0]
  }

  const hash = decodeURIComponent(window.location.hash) || window.location.hash
  if (hash === '#ru') {
    return LanguageSchema.options[1]
  }

  const user_language = LanguageSchema.parse(window.navigator.language)
  if (LanguageSchema.options.includes(user_language)) {
    return user_language
  }

  return LanguageSchema.options[0]
}

export const get_percent = (partial: number, total: number): number => {
  let percent = (100 * partial) / total
  percent = Math.round(percent * 100) / 100
  return percent || 0
}

export const clipboard = (text: string) => {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text)
  }
  // const text_area = document.createElement('textarea')
  // text_area.value = text
  // text_area.style.position = 'fixed'
  // text_area.style.left = '-999999px'
  // text_area.style.top = '-999999px'
  // document.body.appendChild(text_area)
  // text_area.focus()
  // text_area.select()
  // return new Promise<void>((res, rej) => {
  //   document.execCommand('copy') ? res() : rej()
  //   text_area.remove()
  // })
}

export const generate_object = <T extends number | string>(
  keys: string[], value: T
): { [key: string]: T } => {
  const result: { [key: string]: T } = {}
  keys.forEach(key => result[key] = value)
  return result
}

export function order_change<T extends string>(
  current_order: T | `-${T}`, set_order: T, desc_first = false
) {
  const possible_desc: `-${T}` = `-${set_order}`
  const is_current_asc = current_order === set_order
  const is_new = !is_current_asc && current_order !== possible_desc
  const is_desc = is_new ? desc_first : is_current_asc ? true : false
  const new_order = is_desc ? possible_desc : set_order

  return { new_order, is_desc }
}

export const format_label_data = (label_data: LabelData) => {
  // const language = local_profile_manage().language
  // if (label_data.translate) {
  //   return label_data.translate[language]
  // }
  return label_data.label || label_data.name
}

// export const time_to_seconds = (iso_time?: string) => {
//   if (!iso_time) return 0
//   const t = iso_time.split(':').map(p => +p)
//   const seconds = (t[0] * 60 + t[1]) * 60 + t[2]
//   return seconds
// }

// export const format_name = (name?: string): string => {
//   if (!name) return ''
//   const words = name.split('_').filter(word => word.length > 2)
//   if (!words.length) return ''

//   const formatted_words = words.map((word, index) => {
//     if (index === 0) {
//       return capitalize(word)
//     } else {
//       return word
//     }
//   })
//   return formatted_words.join(' ')
// }

export const target_data_cache_mark_to_update = (uno: Uno) => {
  const storage_key = `${C.TARGET}_${C.DATA}_${uno}`
  const storage_key_to_update = `${storage_key}_to_update`
  sessionStorage.setItem(storage_key_to_update, '1')
}

export const is_target_exist = async (uno: string) => {
  const storage_key = `${C.TARGET}_${C.UNO}_${C.ALL}`
  const targets = sessionStorage.getItem(storage_key)
  let target_unos: Uno[]

  if (!targets) {
    target_unos = await target_unos_get(C.ALL)
    sessionStorage.setItem(storage_key, JSON.stringify(target_unos))
  } else {
    target_unos = JSON.parse(targets)
  }

  return target_unos.includes(uno)
}

export async function target_data_cache_get(uno: PlayerUno): Promise<PlayerData | null>
export async function target_data_cache_get(uno: GroupUno): Promise<GroupData | null>
export async function target_data_cache_get(uno: Uno): Promise<PlayerData | GroupData | null> {
  const storage_key = `${C.TARGET}_${C.DATA}_${uno}`
  const storage_key_to_update = `${storage_key}_to_update`

  const is_need_to_update = sessionStorage.getItem(storage_key_to_update)
  if (is_need_to_update) {
    const target_data = await target_data_get(uno)
    if (target_data) {
      sessionStorage.setItem(storage_key, JSON.stringify(target_data))
      sessionStorage.removeItem(storage_key_to_update)
      return target_data
    }
  }

  const data = sessionStorage.getItem(storage_key)
  if (data) return JSON.parse(data)

  const target_data = await target_data_get(uno)
  sessionStorage.setItem(storage_key, JSON.stringify(target_data))

  return target_data
}

export function order_status<T extends string>(order: T | `-${T}`) {
  return {
    current: order as T | `-${T}`,
    column: order.replace('-', '') as T,
    is_desc: order.includes('-'),
  }
}
