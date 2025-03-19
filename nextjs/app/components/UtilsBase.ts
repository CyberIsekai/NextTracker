'use server'

import { and, eq, max, sql, getTableName } from 'drizzle-orm'
import type { SQLWrapper, Table } from 'drizzle-orm'
import { db } from '@/app/components/drizzle/db'
import * as fs from 'fs'
import * as schema from '@/app/components/drizzle/schema'
import redis_manage from '@/app/components/Redis'
import { C } from '@/app/components/Consts'
import { RedisTargetStatus } from '@/app/components/zod/Redis'
import {
    LogsBasic,
    LogsSourceCache,
    LogsTracker,
} from '@/app/components/zod/Logs'
import {
    StatsRow,
    TrackerStatsValue,
} from '@/app/components/zod/TrackerStats'
import {
    Config,
    ConfigName,
    ConfigSource,
} from '@/app/components/zod/Config'

const LOGS_TABLES = {
    // LogsBasic
    logs: schema.logs,
    logs_user: schema.logs_user,
    logs_error: schema.logs_error,
    cod_logs: schema.cod_logs,
    cod_logs_player: schema.cod_logs_player,
    cod_logs_error: schema.cod_logs_error,
    logs_url: schema.logs_url,
    logs_ip: schema.logs_ip,
    // LogsRequests
    logs_request: schema.logs_request,
    logs_request_error: schema.logs_request_error,
    logs_request_auth: schema.logs_request_auth,
    // other
    cod_logs_search: schema.cod_logs_search,
    cod_logs_task_queues: schema.cod_logs_task_queues,
}

export const get_status = async (name: RedisTargetStatus) => {
    const redis_status = await redis_manage(name)
    return redis_status === '1'
}

const in_logs_file = (message: string) => {
    const current_time = new Date().toISOString()
    const log_message = `${current_time}: ${message}\n`

    fs.appendFile('../logs/nextjs_logs.log', log_message, err => {
        if (err) {
            console.log(`${C.ERROR} write to log file`, err)
        }
    })
}

export const in_logs = async (
    target: string,
    message: string,
    source: LogsBasic,
    data: object | null = null,
) => {
    message = `[nextjs] ${message}`
    if (source.includes(C.ERROR)) {
        in_logs_file(`${C.ERROR} ${C.LOGS}
        ${C.TARGET}: ${target}
        ${C.MESSAGE}: ${message}
        ${C.SOURCE}: ${source}`)
    }
    const table = LOGS_TABLES[source]
    await db.insert(table).values({ target, message, data }).execute()
}

export async function logs_cache_get(source: 'cod_logs_cache', index: number): Promise<LogsTracker[]>
export async function logs_cache_get(source: LogsSourceCache, index: number) {
    return redis_manage(source, 'lrange', index)
}

export async function logs_cache_get_page(source: 'cod_logs_cache', page: number): Promise<LogsTracker[]>
export async function logs_cache_get_page(source: LogsSourceCache, page: number) {
    const PAGE_LIMIT = +process.env.PAGE_LIMIT!
    const start = (page - 1) * PAGE_LIMIT
    const stop = start + PAGE_LIMIT
    const logs = await redis_manage(source, 'lrange', start, stop)

    return logs
}

export const logs_cache_delete = async (source: LogsSourceCache) => {
    const logs_count = await redis_manage(source, 'llen')
    await redis_manage(source, 'ltrim')

    return `[${source}] ${C.DELETED} ${C.LOGS} [${logs_count}]`
}

export const log_cache_delete = async (source: LogsSourceCache, log: LogsTracker) => {
    const logs_count = await redis_manage(source, 'lrem', log)

    return `[${source}] ${C.DELETED} ${C.LOGS} [${logs_count}]`
}

export const seconds_wait_expire = async (date: Date | string, delay_seconds: number) => {
    date = typeof date === 'string' ? new Date(date) : date
    const now = new Date().getTime()
    const expire_epoch_date = date.getTime() + delay_seconds * 1000
    const seconds_left = Math.max(0, Math.floor((expire_epoch_date - now) / 1000))
    return seconds_left
}

export async function config_get(name: C.STATS, source: C.TRACKER): Promise<Config & { data: TrackerStatsValue }>
export async function config_get(name: ConfigName, source: ConfigSource): Promise<Config> {
    const config = await db.query.configs.findFirst({
        where: and(
            eq(schema.configs.name, name),
            eq(schema.configs.source, source),
        )
    })

    if (config) return config

    const [max_id] = await db.select({ value: max(schema.configs.id) }).from(schema.configs)
    const [config_added] = await db.insert(schema.configs).values({
        id: max_id.value ? (max_id.value + 1) : undefined,
        name,
        source,
    }).returning()

    return config_added
}

export const configs_get = async (): Promise<Config[]> => (
    await db.select().from(schema.configs).orderBy(schema.configs.id)
)

export const get_stats_row = async (table: Table & { id: SQLWrapper } | null): Promise<StatsRow> => {
    if (!table) return { rows: 0, last_id: 0 }
    const rows = (
        await db.select({ count: sql<number>`count(*)::int` }).from(table)
    )[0].count
    const [data] = await db.select({ last_id: max(table.id) }).from(table)
    const last_id = data.last_id ? +data.last_id : 0

    return { rows, last_id }
}

export const set_table_sequence = async (table: Table, id_seq?: number) => {
    const table_name = getTableName(table)
    const table_seq = `${table_name}_id_seq`
    let query = ''
    if (id_seq === undefined) {
        query = `SELECT setval('${table_seq}', MAX(id)) FROM ${table_name}`
    } else if (id_seq === 0) {
        query = `ALTER SEQUENCE ${table_seq} RESTART WITH 1`
    } else {
        query = `SELECT setval('${table_seq}', ${id_seq}, true)`
    }
    await db.execute(sql.raw(query))
}
