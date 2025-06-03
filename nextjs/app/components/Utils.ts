import { GameStatsDataStats } from '@/app/components/zod/GamesStats'

export const extract_number_value = (value?: number | GameStatsDataStats) => {
    if (!value) return 0
    if (typeof value !== 'number') {
        value = value.kills ?? value.uses ?? value.used ?? 0
    }
    return value
}

export const round_number = (value: number, fixed = 2) => {
    if (value % 1) {
        value = +value.toFixed(fixed)
    }
    return value.toLocaleString()
}

export const extract_ratio = (n: number, n1: number) => +(n / (n1 || 1)).toFixed(2)

export function pop<T extends object, K extends keyof T>(
    obj: T,
    key: K,
    defaultValue?: T[K]
): T[K] {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key]
        delete obj[key]
        return value
    } else if (arguments.length >= 3) {
        return defaultValue!
    }
    throw new Error(`KeyError: ${String(key)}`)
}

export const is_none_value = (value: string) => {
    if (!value) return true
    return ['none', 'nones', 'null', '0'].includes(value)
}
