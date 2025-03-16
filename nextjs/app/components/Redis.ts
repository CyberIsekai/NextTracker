import Redis from 'ioredis'
import { C } from '@/app/components/Consts'
import {
    RedisAction,
    RedisTarget,
    RedisTargetGet,
    RedisTargetStatus,
    RedisTargetHash,
    RedisTargetList,
    RedisValue,
    RedisValueLset,
    RedisTargetKeys,
    RedisTargetDeletePattern,
    CacheKey,
    CachePlayer,
    CacheGroup,
    CachePlayerUnoFind,
    CacheMatchesUid,
    CacheUser,
} from '@/app/components/zod/Redis'
import { PlayerData } from '@/app/components/zod/Player'
import { GamesStatus } from '@/app/components/zod/GameStatus'
import { GamesStats } from '@/app/components/zod/GamesStats'
import { GroupData } from '@/app/components/zod/Group'
import { User } from '@/app/components/zod/User'
import { Task } from '@/app/components/zod/Task'
import { LogsTracker } from '@/app/components/zod/Logs'
import { MatchesResponse } from '@/app/components/zod/Matches'
import { TrackerStatus } from '@/app/components/zod/Panel'
import { PlayerUno } from '@/app/components/zod/Uno'

async function redis_manage(target: CacheUser, action: 'hget', key: string): Promise<User[keyof User]>
async function redis_manage(target: CacheUser, action: 'hset', user: User): Promise<'OK'>
async function redis_manage(target: CacheUser, action: 'hgetall'): Promise<User>
async function redis_manage(target: CacheUser, action: 'hmget', fields: string[]): Promise<User[keyof User][]>

async function redis_manage(target: CachePlayer | CacheGroup, action: 'hget', key: C.GAMES): Promise<GamesStatus | null>
async function redis_manage(target: CachePlayer | CacheGroup, action: 'hget', key: C.GAMES_STATS): Promise<GamesStats | null>

async function redis_manage(target: CachePlayer, action: 'hget', key: C.GROUP): Promise<string | null>
async function redis_manage(target: CachePlayer, action: 'hget', key: string): Promise<PlayerData[keyof PlayerData]>
async function redis_manage(target: CachePlayer, action: 'hset', value: Record<string, PlayerData[keyof PlayerData]>): Promise<number>
async function redis_manage(target: CachePlayer, action: 'hmget', fields: string[]): Promise<PlayerData[keyof PlayerData][]>
async function redis_manage(target: CachePlayer, action: 'hgetall'): Promise<PlayerData | null>

async function redis_manage(target: CachePlayerUnoFind): Promise<string | null>
async function redis_manage(target: CachePlayerUnoFind, action: 'set', uno: PlayerUno): Promise<'OK'>

async function redis_manage(target: CacheGroup, action: 'hget', key: C.PLAYERS): Promise<GroupData['players'] | null>
async function redis_manage(target: CacheGroup, action: 'hset', value: Record<string, GroupData[keyof GroupData]>): Promise<number>
async function redis_manage(target: CacheGroup, action: 'hget', key: string): Promise<GroupData[keyof GroupData]>
async function redis_manage(target: CacheGroup, action: 'hmget', fields: string[]): Promise<GroupData[keyof GroupData][]>
async function redis_manage(target: CacheGroup, action: 'hgetall'): Promise<GroupData | null>

async function redis_manage(target: CachePlayer | CacheGroup, action: 'hget', key: string): Promise<PlayerData[keyof PlayerData] | GroupData[keyof GroupData]>
async function redis_manage(target: CachePlayer | CacheGroup, action: 'hmget', fields: string[]): Promise<PlayerData[keyof PlayerData][] | GroupData[keyof GroupData]>
async function redis_manage(target: CachePlayer | CacheGroup, action: 'hgetall'): Promise<PlayerData | GroupData | null>

async function redis_manage(uid: CacheMatchesUid, action: 'hget', key: CacheKey): Promise<MatchesResponse | null>

async function redis_manage(target: C.STATUS, action: 'set', status: TrackerStatus): Promise<'OK'>
async function redis_manage(target: C.STATUS): Promise<TrackerStatus>

async function redis_manage(target: 'cod_logs_cache', action: 'rpush' | 'lpush', log: LogsTracker): Promise<number>
async function redis_manage(target: 'cod_logs_cache', action: 'lrange', start?: number, stop?: number): Promise<LogsTracker[]>
async function redis_manage(target: 'cod_logs_cache', action: 'lrem', log: LogsTracker): Promise<number>

async function redis_manage(target: C.TASK_QUEUES, action: 'rpush' | 'lpush', task: Task): Promise<number>
async function redis_manage(target: C.TASK_QUEUES, action: 'lrange', start?: number, stop?: number): Promise<Task[]>
async function redis_manage(target: C.TASK_QUEUES, action: 'lindex', index: number): Promise<Task>
async function redis_manage(target: C.TASK_QUEUES, action: 'lset', value: { index: number, value: Task }): Promise<number>
async function redis_manage(target: C.TASK_QUEUES, action: 'lpop'): Promise<Task>
async function redis_manage(target: C.TASK_QUEUES, action: 'lrem', task: Task): Promise<number>

async function redis_manage(target: RedisTargetStatus): Promise<'0' | '1' | null>
async function redis_manage(target: RedisTargetStatus, action: 'set', status: 0 | 1): Promise<'OK'>

async function redis_manage(target: RedisTargetGet): Promise<RedisValue>
// async function redis_manage(target: RedisTargetGet, action: 'set'): Promise<'OK'>

// async function redis_manage(target: RedisTargetList, action: 'rpush' | 'lpush', value: RedisValue): Promise<number>
async function redis_manage(target: RedisTargetList, action: 'lrange', start?: number, stop?: number): Promise<RedisValue[]>
async function redis_manage(target: RedisTargetList, action: 'lindex', index: number): Promise<RedisValue>
async function redis_manage(target: RedisTargetList, action: 'lpop'): Promise<RedisValue>
async function redis_manage(target: RedisTargetList, action: 'llen'): Promise<number>
// async function redis_manage(target: RedisTargetList, action: 'lset', value: RedisValueLset): Promise<number>
async function redis_manage(target: RedisTargetList, action: 'ltrim', index?: number): Promise<'OK'>
// async function redis_manage(target: RedisTargetList, action: 'lrem', value: RedisValue): Promise<number>

async function redis_manage(target: RedisTargetHash, action: 'hset', value: object): Promise<number>
async function redis_manage(target: RedisTargetHash, action: 'hget', value: string): Promise<RedisValue | null>
async function redis_manage(target: RedisTargetHash, action: 'hdel', fields: string | string[]): Promise<number>
async function redis_manage(target: RedisTargetHash, action: 'hkeys'): Promise<string[]>
async function redis_manage(target: RedisTargetHash, action: 'hgetall'): Promise<Record<string, RedisValue>>

async function redis_manage(target: RedisTargetKeys, action: 'keys'): Promise<(CachePlayer | CacheGroup)[]>
async function redis_manage(target: RedisTargetDeletePattern, action: C.DELETE): Promise<number>
async function redis_manage(target: RedisTarget, action: C.DELETE): Promise<number>
async function redis_manage(target: RedisTarget, action: 'flushall'): Promise<'OK'>

async function redis_manage(
    target: RedisTarget,
    action: RedisAction = 'get',
    value: RedisValue | RedisValue[] = 0,
    index = 0,
): Promise<RedisValue | RedisValue[] | null> {
    const redis = new Redis()
    let res: RedisValue | RedisValue[] | null = null

    if (action === 'get') {
        const data = await redis.get(target)
        res = redis_value_get(data)

    } else if (action === 'set') {
        const data = redis_value_set(value)
        res = await redis.set(target, data)

    } else if (action === 'rpush') {
        res = await redis.rpush(target, redis_value_set(value))

    } else if (action === 'lpush') {
        res = await redis.lpush(target, redis_value_set(value))

    } else if (action === 'lrange') {
        const start = typeof value == 'object' ? 0 : value
        const stop = index - 1
        const lrange = await redis.lrange(target, start, stop)
        res = lrange.map(item => redis_value_get(item))

    } else if (action === 'lindex') {
        const index = typeof value == 'number' ? value : 0
        const lindex = await redis.lindex(target, index)
        res = redis_value_get(lindex)

    } else if (action === 'lpop') {
        const lpop = await redis.lpop(target)
        res = redis_value_get(lpop)

    } else if (action === 'llen') {
        res = await redis.llen(target)

    } else if (action === 'lset') {
        if (typeof value === 'object' && !Array.isArray(value)) {
            const v = value as RedisValueLset
            res = await redis.lset(target, v.index, redis_value_set(v.value))
        }
    } else if (action === 'ltrim') {
        const stop_index = typeof value == 'object' ? 0 : +value
        const start_index = stop_index ? 0 : 1
        res = await redis.ltrim(target, start_index, stop_index)

    } else if (action === 'lrem') {
        res = await redis.lrem(target, 0, redis_value_set(value))

    } else if (action === 'hset') {
        for (const [k, v] of Object.entries(value)) {
            res = await redis.hset(target, k, redis_value_set(v))
        }

    } else if (action === 'hget') {
        if (typeof value === 'string') {
            const hget = await redis.hget(target, value)
            res = redis_value_get(hget)
        }

    } else if (action === 'hdel') {
        if (typeof value === 'string') {
            res = await redis.hdel(target, value)
        } else if (Array.isArray(value)) {
            res = await redis.hdel(target, ...value)
        }

    } else if (action === 'hmget') {
        if (Array.isArray(value)) {
            const hmget = await redis.hmget(target, ...value)
            res = hmget.map(v => {
                if (v) {
                    try {
                        v = JSON.parse(v)
                    } catch { }
                }
                return v
            })
        }

    } else if (action === 'hkeys') {
        res = await redis.hkeys(target)

    } else if (action === 'hgetall') {
        const hgetall = await redis.hgetall(target)
        if (Object.keys(hgetall).length) {
            const data: Record<string, RedisValue> = {}
            for (const [k, v] of Object.entries(hgetall)) {
                data[k] = redis_value_get(v) as RedisValue
            }
            res = data
        }

    } else if (action === C.DELETE) {
        if (target.includes('*')) {
            let deleted_count = 0
            for (const key of await redis.keys(target)) {
                await redis.del(key)
                deleted_count++
            }
            res = deleted_count
        } else {
            res = await redis.del(target)
        }

    } else if (action === 'keys') {
        res = await redis.keys(target)

    } else if (action === 'flushall') {
        res = await redis.flushall()
    }

    redis.quit()

    return res
}

const redis_value_get = (value: Buffer | string | null): string | object | null => {
    if (value === null) return value

    if (typeof value === 'object') {
        value = value.toString()
    }

    try {
        const decoded_object = JSON.parse(value)
        if (typeof decoded_object === 'number') {
            return value
        }
        return decoded_object
    } catch { }

    return value
}

const redis_value_set = (value: RedisValue) => {
    if (typeof value === 'object') {
        value = JSON.stringify(value)
    }
    return value
}

export default redis_manage
