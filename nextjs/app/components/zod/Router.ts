import { z } from 'zod'
import { C } from '@/app/components/Consts'
import {
    PlayerDataSchema,
} from '@/app/components/zod/Player'
import {
    UnoSchema,
} from '@/app/components/zod/Uno'
import { GroupDataSchema } from '@/app/components/zod/Group'
import {
    GameSchema,
    ModeSchema,
    GameModeSchema,
} from '@/app/components/zod/GameMode'
import { GameBasicColumnSchema } from '@/app/components/zod/Match'
import {
    Year,
    YearSchema,
} from '@/app/components/zod/Table'
import {
    Month,
    MonthDay,
} from '@/app/components/zod/Chart'

export const RouterDataTypeSchema = z.enum([
    C.UNO, C.USERNAME, C.CLANTAG
])
export type RouterDataType = z.infer<typeof RouterDataTypeSchema>

export const RouterTargetSchema = z.string().nonempty()
export type RouterTarget = z.infer<typeof RouterTargetSchema>

export const RouterOrderSchema = z.enum([C.ID, C.TIME, ...GameBasicColumnSchema.options])
export type RouterOrder = z.infer<typeof RouterOrderSchema>

export const RouterOrderAllSchema = z.enum([
    ...RouterOrderSchema.options,
    ...RouterOrderSchema.options.map(v => `-${v}` as const)
])
export type RouterOrderAll = z.infer<typeof RouterOrderAllSchema>

export const RouterDateSchema = z.string().refine(
    (val): val is '' | Year | `${Year}-${Month}` | `${Year}-${Month}-${MonthDay}` => {
        if (val === '') return true

        const parts = val.split('-')
        const [year, ...rest] = parts

        if (!YearSchema.safeParse(year).success) {
            return false
        }

        return rest.length <= 2 &&
            rest.every(part => /^\d+$/.test(part)) && // only digits allowed
            rest.length !== 0 ? rest[0] !== '' : true // prevent trailing underscores
    },
    val => ({ message: `[${val}] ${C.NOT_VALID}` }),
)
export type RouterDate = z.infer<typeof RouterDateSchema>

export const RouterPageSchema = z.number().nonnegative()
export type RouterPage = z.infer<typeof RouterPageSchema>

export const RouterSchema = z.object({
    data_type: RouterDataTypeSchema,
    target: RouterTargetSchema,
    game: GameSchema,
    mode: ModeSchema,
    game_mode: GameModeSchema,
    order: RouterOrderAllSchema,
    date: RouterDateSchema,
    page: RouterPageSchema,
})
export type Router = z.infer<typeof RouterSchema>

export const ROUTER = RouterSchema.parse({
    data_type: RouterDataTypeSchema.options[0],
    target: C.TRACKER,
    game: GameSchema.options[0],
    mode: ModeSchema.options[0],
    game_mode: GameModeSchema.options[0],
    order: '-time',
    page: 0,
    date: '',
})

export const ContextMatchesStatsNavigationDataTypeSchema = z.enum([C.MATCHES, C.STATS])
export type ContextMatchesStatsNavigationDataType = z.infer<typeof ContextMatchesStatsNavigationDataTypeSchema>

export const ContextMatchesStatsNavigationSchema = z.object({
    data_type: ContextMatchesStatsNavigationDataTypeSchema,
    router: RouterSchema,
    target_data: PlayerDataSchema.or(GroupDataSchema).nullable(),
})
export type ContextMatchesStatsNavigation = z.infer<typeof ContextMatchesStatsNavigationSchema>

export const DataTypeOnlySchema = z.enum([
    C.MATCHES,
    C.MATCHES_HISTORY,
    C.STATS,
])
export type DataTypeOnly = z.infer<typeof DataTypeOnlySchema>

export const UpdateRouterDataTypeSchema = z.enum([
    ...DataTypeOnlySchema.options,
    C.FULLMATCHES_PARS,
    C.ALL,
])
export type UpdateRouterDataType = z.infer<typeof UpdateRouterDataTypeSchema>

export const DataTypeSchema = z.enum([
    ...UpdateRouterDataTypeSchema.options,
    C.FULLMATCHES,
    C.SEARCH,
])
export type DataType = z.infer<typeof DataTypeSchema>

export const UpdateRouterSchema = z.object({
    data_type: UpdateRouterDataTypeSchema,
    uno: UnoSchema,
    game_mode: GameModeSchema,
})
export type UpdateRouter = z.infer<typeof UpdateRouterSchema>

export const RouterGenerateUrlDataTypeSchema = z.enum([
    ...RouterDataTypeSchema.options,
    C.MATCHES,
    C.STATS,
])
export type RouterGenerateUrlDataType = z.infer<typeof RouterGenerateUrlDataTypeSchema>

export const RouterGenerateUrlSchema = z.object({
    data_type: RouterGenerateUrlDataTypeSchema,
    target: RouterTargetSchema,
    game: GameSchema.optional(),
    mode: ModeSchema.optional(),
    order: RouterOrderAllSchema.optional(),
    date: RouterDateSchema.optional(),
    page: RouterPageSchema.optional(),
})
export type RouterGenerateUrl = z.infer<typeof RouterGenerateUrlSchema>

export const UpdateResponseSchema = z.object({
    message: z.string(),
    time: z.string().datetime().nullable(),
    seconds_wait: z.number().nonnegative(),
})
export type UpdateResponse = z.infer<typeof UpdateResponseSchema>
