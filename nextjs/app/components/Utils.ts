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
