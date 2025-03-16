import { z } from 'zod'
import { C } from '@/app/components/Consts'
import { ZObject } from '@/app/components/zod/Utils'

export const ConfigNameSchema = z.enum([C.STATS, 'most_common_uno'])
export type ConfigName = z.infer<typeof ConfigNameSchema>

export const ConfigSourceSchema = z.enum([C.BASE, C.TRACKER])
export type ConfigSource = z.infer<typeof ConfigSourceSchema>

export const ConfigSchema = z.object({
    id: z.number(),
    name: ConfigNameSchema.or(z.string()),
    source: ConfigSourceSchema,
    data: ZObject,
    time: z.date(),
})
export type Config = z.infer<typeof ConfigSchema>

// export const ConfigResponseSchema = z.object({
//     configs: z.array(ConfigSchema),
// })
// export type ConfigResponse = z.infer<typeof ConfigResponseSchema>
