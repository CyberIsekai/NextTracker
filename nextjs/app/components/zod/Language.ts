import { z } from 'zod'
import { C } from '@/app/components/Consts'
import { z_record_strict } from '@/app/components/zod/Utils'

export const TranslateSchema = z.enum([C.TRANSLATE, 'translate_stats'])
export type Translate = z.infer<typeof TranslateSchema>

export const LanguageSchema = z.enum([C.EN, C.RU])
export type Language = z.infer<typeof LanguageSchema>

export const TranslatesWordSchema = z.object({
    id: z.number(),
    name: z.string(),
    en: z.string().nullable(),
    ru: z.string().nullable(),
})
export type TranslatesWord = z.infer<typeof TranslatesWordSchema>

export const TranslatesWordKeySchema = TranslatesWordSchema.keyof()
export type TranslatesWordKey = typeof TranslatesWordKeySchema.options[number]

export const TranslatesResponseSchema = z.object({
    translate: z.array(TranslatesWordSchema),
})
export type TranslatesResponse = z.infer<typeof TranslatesResponseSchema>

export const TranslatesStoreSchema = z.object({
    translate: z.record(z.string(), z_record_strict(LanguageSchema, z.string().nullable())),
    translate_stats: z.record(z.string(), z_record_strict(LanguageSchema, z.string().nullable())),
    version: z.string(),
})
export type TranslatesStore = z.infer<typeof TranslatesStoreSchema>
