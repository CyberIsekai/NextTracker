import {
    index,
    uniqueIndex,
} from 'drizzle-orm/pg-core'
import type {
    IndexBuilder,
    IndexBuilderOn,
    ExtraConfigColumn,
} from 'drizzle-orm/pg-core'

export const index_builder = (
    index_columns: ExtraConfigColumn[],
    index_columns_unique?: ExtraConfigColumn[]
) => {
    const indexes: (IndexBuilder | IndexBuilderOn)[] = []

    for (const index_column of index_columns) {
        const index_name = `ix_${index_column.uniqueName!.split('_unique')[0]}`
        indexes.push(index(index_name).on(index_column))
    }

    if (index_columns_unique) {
        for (const index_column_unique of index_columns_unique) {
            const index_name = `ix_${index_column_unique.uniqueName}`
            indexes.push(uniqueIndex(index_name).on(index_column_unique))
        }
    }

    return indexes
}
