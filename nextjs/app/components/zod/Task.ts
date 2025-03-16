import { z } from 'zod'
import { C } from '@/app/components/Consts'
import {
    GameMode,
    GameModeSchema,
} from '@/app/components/zod/GameMode'
import {
    Uno,
    UnoSchema,
    GroupUnoSchema,
    PlayerUnoSchema,
} from '@/app/components/zod/Uno'
import {
    DataType,
    DataTypeSchema,
} from '@/app/components/zod/Router'

export const TaskNameSchema = z.string()
    .refine(
        (val): val is `${Uno} ${GameMode} ${DataType}` => {
            try {
                const [uno, game_mode, data_type] = val.split(' ')

                const is_valid_uno = PlayerUnoSchema.safeParse(uno).success ||
                    GroupUnoSchema.safeParse(uno).success
                const is_valid_game_mode = GameModeSchema.safeParse(game_mode).success
                const is_valid_data_type = DataTypeSchema.safeParse(data_type).success

                return is_valid_uno && is_valid_game_mode && is_valid_data_type
            } catch {
                return false
            }
        },
        { message: 'Must follow format: [Uno, GameMode, DataType]' }
    )
export type TaskName = z.infer<typeof TaskNameSchema>

export const TaskStatusSchema = z.nativeEnum({
    PENDING: 'pending',
    RUNNING: 'running',
    PAUSE: 'pause',
    COMPLETED: C.COMPLETED,
    ERROR: C.ERROR,
    DELETED: C.DELETED,
} as const)
export type TaskStatus = z.infer<typeof TaskStatusSchema>

export const TaskStatusResponceSchema = z.nativeEnum({
    STARTED: 'started',
    ADDED: 'added',
    ALREADY_RUNNING: 'already running',
    IN_QUEUES: 'in queues',
} as const)
export type TaskStatusResponce = z.infer<typeof TaskStatusResponceSchema>

export const TaskSchema = z.object({
    id: z.number(),
    name: TaskNameSchema,
    uno: UnoSchema,
    game_mode: GameModeSchema,
    data_type: DataTypeSchema,
    status: TaskStatusSchema,
    data: z.record(z.string(), z.string().or(z.number())),
    time: z.string().datetime(),
    time_started: z.string().datetime().nullable(),
    time_end: z.string().datetime().nullable(),
})
export type Task = z.infer<typeof TaskSchema>
