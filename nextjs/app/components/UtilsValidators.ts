import {
    C,
} from '@/app/components/Consts'
import { PlayerData } from '@/app/components/zod/Player'
import { GroupData } from '@/app/components/zod/Group'
import {
    GameMode,
    GameModeMw,
    GameModeMwSchema,
    GameModeSchema,
} from '@/app/components/zod/GameMode'

export const is_best_record = (stat_name: string) => (
    ['longestStreak', 'currentWinStreak'].includes(stat_name) ||
    stat_name.includes('best') ||
    stat_name.includes('record') ||
    stat_name.includes('most')
)

export const is_game_mode_mw = (game_mode: C): game_mode is GameModeMw => (
    GameModeMwSchema.safeParse(game_mode).success
)
export const is_game_mode = (game_mode: string): game_mode is GameMode => (
    GameModeSchema.safeParse(game_mode).success
)
export const validate_game_mode = (game_mode: string): GameMode => {
    const [game, mode] = game_mode.split('_')

    if (mode === C.ALL) {
        if (game === C.ALL) {
            game_mode = C.ALL
        } else if (game === C.CW) {
            game_mode = C.CW_MP
        } else if (game === C.VG) {
            game_mode = C.VG_MP
        } else if (game === C.MW) {
            game_mode = C.MW_MP
        }
    }

    return GameModeSchema.parse(game_mode)
}

export const is_number = (str: string | null): boolean => {
    if (str === null || str === '') return false
    return !isNaN(Number(str))
}
// export const validate_number = (str: string | number): number => {
//     if (typeof str === 'number') return str
//     if (!is_number(str)) {
//         throw new Error(`number [${str}] ${C.NOT_VALID}`)
//     }
//     return +str
// }

export const validate_email = (email: string | null) => {
    if (!email?.trim()) return false
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return regex.test(email)
}

export const is_player = (target_data?: object | null): target_data is PlayerData => {
    if (!target_data) return false
    return (target_data as PlayerData).group !== undefined
}

export const is_group = (target_data?: object | null): target_data is GroupData => {
    if (!target_data) return false
    return (target_data as GroupData).players !== undefined
}
