import { z } from 'zod'
import { YearSchema } from '@/app/components/zod/Table'

export const MonthsSchema = z.nativeEnum({
    January: '1',
    February: '2',
    March: '3',
    April: '4',
    May: '5',
    June: '6',
    July: '7',
    August: '8',
    September: '9',
    October: '10',
    November: '11',
    December: '12'
} as const)
export const MonthSchema = z.coerce.string().pipe(MonthsSchema)
export type Month = z.infer<typeof MonthSchema>

export const MonthDaySchema = z.enum([
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
    '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
    '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
    '31'
])
export type MonthDay = z.infer<typeof MonthDaySchema>

const ChartDataYearSchema = z.object({
    summ: z.number().nonnegative(),
    months: z.record(
        MonthSchema,
        z.object({
            summ: z.number().nonnegative(),
            days: z.record(
                MonthDaySchema,
                z.number().nonnegative()
            )
        })
    )
})
export type ChartDataYear = z.infer<typeof ChartDataYearSchema>

const ChartDataSchema = z.object({
    summ: z.number().nonnegative(),
    years: z.record(YearSchema, ChartDataYearSchema)
})
export const ChartSchema = z.object({
    all: ChartDataSchema,
    mw_mp: ChartDataSchema,
    mw_wz: ChartDataSchema,
    cw_mp: ChartDataSchema,
    vg_mp: ChartDataSchema,
    time: z.string().datetime(),
})
export type Chart = z.infer<typeof ChartSchema>
