'use server'

import { getTableName } from 'drizzle-orm'
import * as schema from '@/app/components/drizzle/schema'
import { C } from '@/app/components/Consts'
import {
    YearWzTable,
    TableGameData,
} from '@/app/components/zod/Table'
import {
    GameMode,
    GameModeOnly,
    GameModeMw,
    GameModeOnlySchema,
} from '@/app/components/zod/GameMode'
import {
    MatchesSource,
    MatchesSourceFullmatches,
    MatchesSourceMatches,
} from '@/app/components/zod/MatchesSource'

const GAME_TABLES = {
    [C.MATCHES]: {
        [C.MW_MP]: schema.cod_matches_mw_mp,
        [C.MW_WZ]: schema.cod_matches_mw_wz,
        [C.CW_MP]: schema.cod_matches_cw_mp,
        [C.VG_MP]: schema.cod_matches_vg_mp,
    },
    [C.FULLMATCHES]: {
        [C.MW_MP]: {
            [C.MAIN]: schema.cod_fullmatches_mw_mp,
            [C.BASIC]: schema.cod_fullmatches_basic_mw_mp,
        },
        [C.MW_WZ]: {
            [C.MAIN]: {
                '2020': schema.cod_fullmatches_mw_wz_2020,
                '2021': schema.cod_fullmatches_mw_wz_2021,
                '2022': schema.cod_fullmatches_mw_wz_2022,
                '2023': schema.cod_fullmatches_mw_wz_2023,
            },
            [C.BASIC]: {
                '2020': schema.cod_fullmatches_basic_mw_wz_2020,
                '2021': schema.cod_fullmatches_basic_mw_wz_2021,
                '2022': schema.cod_fullmatches_basic_mw_wz_2022,
                '2023': schema.cod_fullmatches_basic_mw_wz_2023,
            }
        }
    },
} as const

export async function get_game_table(game_mode: GameModeOnly, source: C.MATCHES): Promise<typeof GAME_TABLES[C.MATCHES][C.MW_MP]>
export async function get_game_table(game_mode: C.MW_MP, source: C.MAIN): Promise<typeof GAME_TABLES[C.FULLMATCHES][C.MW_MP][C.MAIN]>
export async function get_game_table(game_mode: C.MW_MP, source: C.BASIC): Promise<typeof GAME_TABLES[C.FULLMATCHES][C.MW_MP][C.BASIC]>
export async function get_game_table(game_mode: C.MW_WZ, source: C.MAIN, year: YearWzTable): Promise<typeof GAME_TABLES[C.FULLMATCHES][C.MW_WZ][C.MAIN]['2020']>
export async function get_game_table(game_mode: C.MW_WZ, source: C.BASIC, year: YearWzTable): Promise<typeof GAME_TABLES[C.FULLMATCHES][C.MW_WZ][C.BASIC]['2020']>
export async function get_game_table(
    game_mode: GameModeOnly,
    source: Exclude<MatchesSource, C.ALL>,
    year?: YearWzTable
) {
    if (source === C.MATCHES) {
        return GAME_TABLES[source][game_mode]
    }

    if (game_mode === C.CW_MP || game_mode === C.VG_MP) {
        return
    }

    if (game_mode === C.MW_MP) {
        return GAME_TABLES[C.FULLMATCHES][game_mode][source]
    }

    if (year) {
        return GAME_TABLES[C.FULLMATCHES][game_mode][source][year]
    }
}

export async function get_game_tables(
    game_mode: GameMode,
    source: MatchesSourceMatches
): Promise<TableGameData<typeof GAME_TABLES[C.MATCHES][C.MW_MP]>[]>
export async function get_game_tables(
    game_mode: GameModeMw | C.ALL,
    source: MatchesSourceFullmatches
): Promise<
    TableGameData<typeof GAME_TABLES[C.FULLMATCHES][C.MW_MP][C.BASIC]>[] |
    TableGameData<typeof GAME_TABLES[C.FULLMATCHES][C.MW_WZ][C.BASIC]['2020']>[]
>
export async function get_game_tables(game_mode: GameMode, source: MatchesSource) {
    const tables: TableGameData[] = []

    if (source === C.MATCHES) {
        if (game_mode === C.ALL) {
            for (const [game_mode, table] of Object.entries(GAME_TABLES[source])) {
                tables.push({
                    game_mode: GameModeOnlySchema.parse(game_mode),
                    table,
                    name: getTableName(table),
                    source
                })
            }
        } else {
            const table = GAME_TABLES[source][game_mode]
            tables.push({
                game_mode,
                table,
                name: getTableName(table),
                source
            })
        }
    }

    else if (game_mode === C.CW_MP || game_mode === C.VG_MP) { }

    else if (source === C.ALL) {
        if (game_mode === C.ALL) {
            const mw_wz = await get_game_tables(C.MW_WZ, source)
            const mw_mp = await get_game_tables(C.MW_MP, source)
            mw_wz.forEach(table => tables.push(table))
            mw_mp.forEach(table => tables.push(table))
        } else if (game_mode === C.MW_MP) {
            const source_tables = GAME_TABLES[C.FULLMATCHES][game_mode]
            for (const [source, table] of Object.entries(source_tables)) {
                tables.push({
                    game_mode,
                    table,
                    name: getTableName(table),
                    source: source as keyof typeof source_tables
                })
            }
        } else if (game_mode === C.MW_WZ) {
            const source_year_tables = GAME_TABLES[C.FULLMATCHES][game_mode]
            for (const [source, years] of Object.entries(source_year_tables)) {
                for (const table of Object.values(years)) {
                    tables.push({
                        game_mode,
                        table,
                        name: getTableName(table),
                        source: source as keyof typeof source_year_tables
                    })
                }
            }
        }
    }

    else if (game_mode === C.ALL) {
        const mw_wz = await get_game_tables(C.MW_WZ, source)
        const mw_mp = await get_game_tables(C.MW_MP, source)
        mw_wz.forEach(table => tables.push(table))
        mw_mp.forEach(table => tables.push(table))
    }

    else if (game_mode === C.MW_MP) {
        const table = GAME_TABLES[C.FULLMATCHES][game_mode][source]
        tables.push({
            game_mode,
            table,
            name: getTableName(table),
            source
        })
    }

    else if (game_mode === C.MW_WZ) {
        for (const table of Object.values(GAME_TABLES[C.FULLMATCHES][game_mode][source])) {
            tables.push({
                game_mode,
                table,
                name: getTableName(table),
                source
            })
        }
    }

    return tables
}
