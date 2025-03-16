import { z } from 'zod'
import {
    C,
    NAME_LIMIT_2,
} from '@/app/components/Consts'
import { GameModeSchema } from '@/app/components/zod/GameMode'

export const LabelTypeSchema = z.enum([
    C.MAP, C.MODE, 'weapons', 'attachments', 'perks',
    'killstreaks', 'tactical', 'lethal', C.GAMES_STATS
])
export type LabelType = z.infer<typeof LabelTypeSchema>

export const LabelDataNameSchema = z.string()
    .max(NAME_LIMIT_2)
    .refine(val => !val.includes(' '), { message: 'must not contain spaces' })
export const LabelDataLabelSchema = z.string().max(NAME_LIMIT_2).nullable()
export const LabelDataSchema = z.object({
    name: LabelDataNameSchema,
    label: LabelDataLabelSchema,
})
export type LabelData = z.infer<typeof LabelDataSchema>

export const LabelsItemSchema = LabelDataSchema.merge(z.object({
    id: z.number(),
    game_mode: GameModeSchema,
    time: z.string().datetime(),
}))
export type LabelsItem = z.infer<typeof LabelsItemSchema>

export const LabelsSchema = z.object({
    labels: z.array(LabelsItemSchema),
})
export type Labels = z.infer<typeof LabelsSchema>

