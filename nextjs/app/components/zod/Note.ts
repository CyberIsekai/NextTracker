import { z } from 'zod'
import { C } from '@/app/components/Consts'

export const NoteSchema = z.object({
    message: z.string(),
    epoch: z.number().nonnegative(),
    complete_epoch: z.number().nonnegative(),
})
export type Note = z.infer<typeof NoteSchema>

export const NoteDataSchema = z.object({
    id: z.number(),
    name: z.string(),
    data: NoteSchema,
    completed: z.boolean(),
    time: z.string().datetime(),
})
export type NoteData = z.infer<typeof NoteDataSchema>

export const NoteTypeSchema = z.enum([C.COMPLETED, C.UNCOMPLETED, C.ALL])
export type NoteType = z.infer<typeof NoteTypeSchema>

export const NoteCategoriSchema = z.enum([C.COMPLETED, C.UNCOMPLETED, C.DELETED])
export type NoteCategori = z.infer<typeof NoteCategoriSchema>

export const NoteResponseSchema = z.object({
    notes: z.array(NoteDataSchema),
    stats: z.record(NoteTypeSchema, z.number())
        .refine((note_type_stats): note_type_stats is Required<typeof note_type_stats> => (
            NoteTypeSchema.options.every(note_type => note_type_stats[note_type] != null)
        ))
})
export type NoteResponse = z.infer<typeof NoteResponseSchema>

export const NoteCategoriesSchema = z.object({
    completed: z.array(NoteDataSchema),
    uncompleted: z.array(NoteDataSchema),
    deleted: z.array(NoteDataSchema),
})
export type NoteCategories = z.infer<typeof NoteCategoriesSchema>
