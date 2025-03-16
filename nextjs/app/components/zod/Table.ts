import { z } from 'zod'
import { GameModeOnlySchema } from '@/app/components/zod/GameMode'
import { MatchesSourceSchema } from '@/app/components/zod/MatchesSource'

export const YearWzSchema = z.enum(['2020', '2021', '2022', '2023'])
export const YearWzTableSchema = z.coerce.string().pipe(YearWzSchema)
export type YearWzTable = z.infer<typeof YearWzTableSchema>

export const YearMpSchema = z.enum(['2019', ...YearWzSchema.options])
export const YearSchema = z.coerce.string().pipe(YearMpSchema)
export type Year = z.infer<typeof YearSchema>

export const TableCsvSchema = z.enum([
    'cod_matches_mw_mp',
    'cod_matches_mw_wz',
    'cod_matches_cw_mp',
    'cod_matches_vg_mp',

    'cod_fullmatches_mw_mp',
    'cod_fullmatches_basic_mw_mp',

    'cod_fullmatches_mw_wz_2020',
    'cod_fullmatches_mw_wz_2021',
    'cod_fullmatches_mw_wz_2022',
    'cod_fullmatches_mw_wz_2023',

    'cod_fullmatches_basic_mw_wz_2020',
    'cod_fullmatches_basic_mw_wz_2021',
    'cod_fullmatches_basic_mw_wz_2022',
    'cod_fullmatches_basic_mw_wz_2023',
])
export type TableCsv = z.infer<typeof TableCsvSchema>

export const TableNameSchema = z.enum([
    'cod_matches_cw_mp',
    'cod_matches_mw_mp',
    'cod_matches_mw_wz',
    'cod_matches_vg_mp',

    'cod_fullmatches_mw_mp',
    'cod_fullmatches_basic_mw_mp',

    'cod_fullmatches_mw_wz_2020',
    'cod_fullmatches_mw_wz_2021',
    'cod_fullmatches_mw_wz_2022',
    'cod_fullmatches_mw_wz_2023',

    'cod_fullmatches_basic_mw_wz_2020',
    'cod_fullmatches_basic_mw_wz_2021',
    'cod_fullmatches_basic_mw_wz_2022',
    'cod_fullmatches_basic_mw_wz_2023',
])
export type TableName = z.infer<typeof TableNameSchema>

export const create_TableGameDataSchema = <T extends z.ZodTypeAny>(tableSchema: T) =>
    z.object({
        game_mode: GameModeOnlySchema,
        table: tableSchema,
        name: TableNameSchema,
        source: MatchesSourceSchema,
    })
export type TableGameData<T = unknown> = z.infer<
    ReturnType<typeof create_TableGameDataSchema<z.ZodType<T>>>
>
