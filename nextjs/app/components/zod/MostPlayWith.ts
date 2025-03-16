import { z } from 'zod'
import { PlayerUnoSchema } from '@/app/components/zod/Uno'

const MostPlayWithDataSchema = z.object({
    uno: z.string(),
    count: z.number().nonnegative(),
    username: z.string(),
    clantag: z.string(),
})
export type MostPlayWithData = z.infer<typeof MostPlayWithDataSchema>

export const MostPlayWithSchema = z.object({
    all: z.array(MostPlayWithDataSchema),
    mw_mp: z.array(MostPlayWithDataSchema),
    mw_wz: z.array(MostPlayWithDataSchema),
    time: z.string().datetime(),
})
export type MostPlayWith = z.infer<typeof MostPlayWithSchema>

export const MostCommonUnoDataSchema = z.object({
    uno: PlayerUnoSchema,
    count: z.number().nonnegative(),
    username: z.array(z.string()),
    clantag: z.array(z.string()),
})
export type MostCommonUnoData = z.infer<typeof MostCommonUnoDataSchema>
