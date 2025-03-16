import { z } from 'zod'

export type Enumerate<N extends number, Acc extends number[] = []> = Acc['length'] extends N
    ? Acc[number]
    : Enumerate<N, [...Acc, Acc['length']]>
export type Range<F extends number, T extends number> = Exclude<Enumerate<T>, Enumerate<F>>
export const z_number_range_generator = <S extends number, E extends number>(start: S, end: E) => z
    .number()
    .int()
    .min(start)
    .max(end)
    .refine(
        (val): val is Range<S, E> => val >= start && val <= end,
        { message: `Number must be between ${start} and ${end} inclusive` }
    )

export const ZObject = z.custom<object>(
    val => typeof val === 'object' && val !== null,
    { message: 'Must be an object' }
)

export const z_record_strict = <
    TEnumValues extends [string, ...string[]],
    V extends z.ZodTypeAny,
>(
    keys: z.ZodEnum<TEnumValues>,
    value: V,
) => z.record(keys, value)
    .superRefine((record, ctx) => {
        const missing_keys = keys.options.filter(
            key => !Object.hasOwn(record, key)
        )
        missing_keys.forEach(key => {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Missing required key: ${String(key)}`,
                path: [key]
            })
        })
    })
    .transform(record => {
        type K = TEnumValues[number]
        return Object.fromEntries(
            keys.options.map(key => [key, record[key as K]])
        ) as Record<K, z.infer<V>>
    })
