import { z } from 'zod'
import { C } from '@/app/components/Consts'

export type GameModeMap<T extends string = GameMode> = {
    [K in T]?: [Game, Mode]
}

export const GameOnlySchema = z.enum([C.MW, C.CW, C.VG])
export type GameOnly = z.infer<typeof GameOnlySchema>

export const GameSchema = z.enum([C.ALL, ...GameOnlySchema.options])
export type Game = z.infer<typeof GameSchema>

export const ModeOnlySchema = z.enum([C.MP, C.WZ])
export type ModeOnly = z.infer<typeof ModeOnlySchema>

export const ModeSchema = z.enum([C.ALL, ...ModeOnlySchema.options])
export type Mode = z.infer<typeof ModeSchema>

export const GameModeMwSchema = z.enum([C.MW_MP, C.MW_WZ])
export type GameModeMw = z.infer<typeof GameModeMwSchema>

export const GameModeOnlySchema = z.enum([...GameModeMwSchema.options, C.CW_MP, C.VG_MP])
export type GameModeOnly = z.infer<typeof GameModeOnlySchema>

export const GameModeSchema = z.enum([C.ALL, ...GameModeOnlySchema.options])
export type GameMode = z.infer<typeof GameModeSchema>

export const GameModeMappingSchema = z.record(
    GameModeSchema,
    z.tuple([GameSchema, ModeSchema])
).refine(
    (game_modes): game_modes is Required<typeof game_modes> => (
        GameModeSchema.options.every(game_mode => game_mode in game_modes)
    ),
    {
        message: 'Must contain all GameMode entries',
        path: ['GAME_MODES']
    }
)
export type GameModeMapping = z.infer<typeof GameModeMappingSchema>
export const GAME_MODES = GameModeMappingSchema.parse({
    [C.ALL]: [C.ALL, C.ALL],
    [C.MW_MP]: [C.MW, C.MP],
    [C.MW_WZ]: [C.MW, C.WZ],
    [C.CW_MP]: [C.CW, C.MP],
    [C.VG_MP]: [C.VG, C.MP],
}) // Record<GameMode, [Game, Mode]>
export function game_mode_split(game_mode: GameModeOnly): [GameOnly, ModeOnly]
export function game_mode_split(game_mode: GameMode): [Game, Mode]
export function game_mode_split(game_mode: GameMode): [Game, Mode] {
    return GAME_MODES[game_mode]
}

export const GAME_MODE_TITLES = {
    [C.ALL]: C.ALL,
    [C.MW_MP]: 'Modern Warfare 2019 [Multiplayer]',
    [C.MW_WZ]: 'Modern Warfare 2019 [Warzone]',
    [C.CW_MP]: 'Black Ops - Cold War',
    [C.VG_MP]: 'Vanguard',
} as const
