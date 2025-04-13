'use client'

import { useEffect, useState, use } from 'react'
import useAppContext from '@/app/components/AppContext'
import FormatedTime from '@/app/components/jsx/FormatedTime'
import { IconTrash } from '@/app/components/Icons'
import { useLabelsContext } from '../navigation'
import {
    fetch_request,
} from '@/app/components/UtilsClient'
import {
    C,
    TIME_ALERT_2,
} from '@/app/components/Consts'
import {
    Message,
    RequestMethodSchema,
} from '@/app/components/zod/Main'
import {
    LabelDataLabelSchema,
    LabelDataNameSchema,
    Labels,
    LabelsItem,
    LabelTypeSchema,
} from '@/app/components/zod/Label'
import {
    GameMode,
    GameModeSchema,
} from '@/app/components/zod/GameMode'

export default function LabelsPage({ params }: {
    params?: Promise<{ label_type: string }>
}) {
    const { t } = useAppContext()
    const { tab_update, count } = useLabelsContext()

    const [labels, setLabels] = useState<LabelsItem[]>([])
    const [error, setError] = useState('')

    const label_type = LabelTypeSchema.parse(params ? use(params).label_type : C.MAP)

    const fetch_data = async () => {
        const res = await fetch_request<Labels>(`labels/${label_type}`)
        if (!res || res.detail) {
            setError(res?.detail || C.ERROR)
        } else {
            setError('')
            setLabels(res.labels)
        }
    }

    useEffect(() => {
        fetch_data()
    }, [])

    const labels_delete_all = async () => {
        if (!confirm(t(`${C.DELETE} ${C.ALL} ${label_type} labels ?`))) {
            return
        }
        const res = await fetch_request<Message>(
            `labels/${label_type}`, undefined, RequestMethodSchema.enum.DELETE
        )

        if (!res || res.detail) {
            setError(res?.detail || C.ERROR)
        } else {
            setLabels([])
            tab_update(label_type, 0)
        }
    }

    const labels_delete = async (label: LabelsItem) => {
        if (!confirm(t(`${C.DELETE} [${label.name}] ?
        ${C.ALL} ${C.LOADOUT} ${C.STATS} ${label_type} with the index [${label.id}]
        will be lost or replaced with another ${C.LABEL}`))) return

        const res = await fetch_request<LabelsItem>(
            `labels/${label_type}/${label.name}`, undefined, RequestMethodSchema.enum.DELETE
        )

        if (!res || res.detail) {
            setError(res?.detail || C.ERROR)
        } else {
            setLabels(prev => prev.filter(label => label.id !== res.id))
            tab_update(label_type, -1)
        }
    }

    const labels_post = async (name: string) => {
        if (!LabelDataNameSchema.safeParse(name).success) return

        const label_index = labels.findIndex(label => label.name === name)
        if (label_index !== -1) {
            const component = document.getElementById(name)
            if (component) {
                component.className = 'bg-yellow-400/10'
                component.scrollIntoView({ block: 'center', inline: 'nearest' })
            }
            return
        }

        const label: LabelsItem = {
            id: -1,
            name,
            label: null,
            game_mode: C.MW_MP,
            time: new Date().toISOString()
        }

        const res = await fetch_request<LabelsItem>(`labels/${label_type}`, label)

        if (!res || res.detail) {
            setError(res?.detail || C.ERROR)
        } else {
            setLabels(prev => [res, ...prev])
        }
    }

    const labels_put = async (label: LabelsItem) => {
        const res = await fetch_request<LabelsItem>(
            `labels/${label_type}`, label, RequestMethodSchema.enum.PUT
        )

        if (!res || res.detail) return res?.detail || C.ERROR

        setLabels(prev => {
            const config_index = prev.findIndex(config => config.id === res.id)
            if (config_index !== -1) {
                prev[config_index] = res
            }
            return [...prev]
        })
    }

    return <>
        <title>{t(`${label_type} labels`)}</title>
        <div className="text-center">
            <button
                type='button'
                className="link text-white disabled:opacity-75"
                title={t(C.REFRESH)}
                onClick={fetch_data}
            >{t(C.REFRESH)}</button>
            {error && <p className="message-error">{t(error)}</p>}
        </div>

        <input
            type="text"
            className="p-1 m-2 w-1/5 text-center bg-gray-800 rounded"
            placeholder={t(`${C.SEARCH} or add ${C.LABEL}`)}
            onKeyDown={e => {
                if (e.code === 'Enter') {
                    const target = e.target as HTMLInputElement
                    labels_post(target.value.trim())
                    target.value = ''
                }
            }}
        />

        <table className="table_logs p-4">
            <thead className="sticky top-1 z-[4]">
                <tr>
                    <th>[{labels.length}-{count}]</th>
                    <th>{t(C.NAME)}</th>
                    <th>{t(C.LABEL)}</th>
                    <th>{t(C.GAME_MODE)}</th>
                    <th>{t(C.TIME)}</th>
                    <th>
                        <button
                            type="button"
                            className="text-red-500 hover:text-500/70"
                            title={t(`${C.DELETE} ${C.ALL} ${label_type} labels ?`)}
                            disabled={!labels.length}
                            onClick={labels_delete_all}
                        >{t(C.DELETE)}</button>
                    </th>
                </tr>
            </thead>
            <tbody>
                {labels.map(label => (
                    <LabelRow
                        key={label.name}
                        label={label}
                        labels_put={labels_put}
                        labels_delete={labels_delete}
                    />
                ))}
            </tbody>
        </table>
    </>
}

const LabelRow = ({
    label, labels_put, labels_delete
}: {
    label: LabelsItem,
    labels_put: (label: LabelsItem) => Promise<string | undefined>,
    labels_delete: (label: LabelsItem) => Promise<void>
}) => {
    const { t } = useAppContext()

    const LabelCell = () => {
        const [editMode, setEditMode] = useState(false)
        const [error, setError] = useState('')

        if (error) {
            new Promise(r => setTimeout(r, TIME_ALERT_2)).then(() => setError(''))
            return <span className="message-error">{t(error)}</span>
        }

        if (!editMode) {
            return (
                <button
                    type="button"
                    className="break-words max-w-xs"
                    title={t(`click for change ${C.LABEL}`)}
                    onClick={() => setEditMode(true)}
                >{label.label || <span className="text-2xl">+</span>}</button>
            )
        }

        const submit_labels_put = async (form_data: FormData) => {
            const new_label = form_data.get(C.VALUE)?.toString().trim() || null

            if (!LabelDataLabelSchema.safeParse(new_label).success) {
                setEditMode(false)
                setError(`${C.LABEL} ${C.NOT_VALID}`)
                return
            }
            if (new_label === label.label) {
                setEditMode(false)
                return
            }

            const error_message = await labels_put({ ...label, label: new_label })

            if (error_message) {
                setEditMode(false)
                setError(error_message)
            } else {
                label.label = new_label
            }
        }

        return (
            <form action={submit_labels_put}>
                <input
                    type="text"
                    name={C.LABEL}
                    className="p-1 text-black"
                    title={t(`change ${C.LABEL}`)}
                    placeholder={t(C.LABEL)}
                    defaultValue={label.label || ''}
                    autoFocus
                />
                <button type="submit" className="ml-2">✔</button>
            </form >
        )
    }

    const GameModeCell = () => {
        const [error, setError] = useState('')

        const change_game_mode = async (game_mode: GameMode) => {
            const error_message = await labels_put({ ...label, game_mode })
            if (error_message) {
                setError(error_message)
            } else {
                label.game_mode = game_mode
            }
        }

        if (error) {
            new Promise(r => setTimeout(r, TIME_ALERT_2)).then(() => setError(''))
            return <span className="message-error">{t(error)}</span>
        }

        return (
            <label title={t(`choose ${C.GAME_MODE}`)}>
                <select
                    className="p-1 text-center text-xs bg-transparent"
                    onChange={e => change_game_mode(GameModeSchema.parse(e.target.value))}
                    defaultValue={label.game_mode}
                >
                    {GameModeSchema.options.map(game_mode => (
                        <option key={game_mode} value={game_mode}>
                            {t(game_mode)}
                        </option>
                    ))}
                </select>
            </label>
        )
    }

    return (
        <tr id={label.name}>
            <td>{label.id}</td>
            <td>{label.name}</td>
            <td className="text-center"><LabelCell /></td>
            <td className="text-center"><GameModeCell /></td>
            <td><FormatedTime time={label.time} /></td>
            <td className="text-center">
                <button
                    type="button"
                    title={`${t(C.DELETE)} ${label.name} ?`}
                    className="flex m-auto text-red-500"
                    onClick={() => labels_delete(label)}
                ><IconTrash /></button>
            </td>
        </tr >
    )
}
