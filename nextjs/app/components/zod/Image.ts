import { z } from 'zod'
import {
    GameModeOnlySchema,
    GameModeSchema,
} from '@/app/components/zod/GameMode'
import { z_record_strict } from '@/app/components/zod/Utils'

export const ImageGameMapSchema = z.object({
    name: z.string(),
    time: z.string().datetime(),
})
export type ImageGameMap = z.infer<typeof ImageGameMapSchema>

export const ImageGameMapsSchema = z_record_strict(
    GameModeOnlySchema, z.array(ImageGameMapSchema)
)
export type ImageGameMaps = z.infer<typeof ImageGameMapsSchema>

export const ImageUploadFilesSchema = z.object({
    name: z.string(),
    b64_thumb: z.string(),
    b64_full: z.string(),
})
export type ImageUploadFiles = z.infer<typeof ImageUploadFilesSchema>

export const ImageUploadSchema = z.object({
    files: z.array(ImageUploadFilesSchema),
    epoch: z.number().nonnegative(),
})
export type ImageUpload = z.infer<typeof ImageUploadSchema>

export const ImageUploadSubmitSchema = z.object({
    images: z.array(z.string()),
    epoch: z.number().nonnegative(),
    game_mode: GameModeSchema,
})
export type ImageUploadSubmit = z.infer<typeof ImageUploadSubmitSchema>

export const ImageDataSchema = z.object({
    name: z.string(),
    new_name: z.string(),
    game_mode: GameModeSchema,
})
export type ImageData = z.infer<typeof ImageDataSchema>
