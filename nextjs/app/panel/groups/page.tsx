'use client'

import { useEffect, useState } from 'react'
import useAppContext from '@/app/components/AppContext'
import { C } from '@/app/components/Consts'
import {
    clipboard,
} from '@/app/components/UtilsClient'
import { groups_cache_get } from '@/app/components/UtilsTracker'
import {
    IconBook,
    IconClipBoard,
} from '@/app/components/Icons'
import { GroupData, GroupDataSchema } from '@/app/components/zod/Group'


export default function Groups() {
    const { t, modal_open } = useAppContext()

    const [groups, setGroups] = useState<GroupData[]>()
    const [status, setStatus] = useState<React.JSX.Element | null>(null)

    const fetch_data = async () => {
        try {
            setGroups(await groups_cache_get())
            setStatus(null)
        } catch {
            setStatus(
                <div className="message-error">
                    {t(`get ${C.DATA} ${C.ERROR}`)}
                </div>
            )
        }
    }

    useEffect(() => {
        fetch_data()
    }, [])

    if (!groups) return <div>{t(C.LOADING)}</div>
    if (!groups.length) return <div>{t(`${C.GROUPS} ${C.NOT_FOUND}`)}</div>

    const ShowChoosen = ({ stat_data, title }: {
        stat_data: GroupData[keyof GroupData], title: keyof GroupData
    }) => (
        <div className="flex flex-col">
            <h3 className="basic-title text-3xl text-center">{title}</h3>
            <form>
                <textarea
                    className="p-4 mt-4 rounded bg-gray-800 text-white"
                    placeholder={t(`${C.GROUP} ${C.VALUE}`)}
                    defaultValue={JSON.stringify(stat_data, null, 4)}
                    rows={8}
                    cols={80}
                />
                <div className="flex items-center">
                    <div className="p-2 flex gap-4 ml-auto">
                        <button
                            type="button"
                            title={t('copy')}
                            onClick={() => clipboard(JSON.stringify(stat_data, null, 4))}
                        ><IconClipBoard /></button>
                    </div>
                </div>
            </ form>
        </div>
    )

    return <>
        <title>{t(C.GROUPS)}</title>
        <div className="p-4 text-center">
            <button
                type='button'
                className="link text-white"
                onClick={fetch_data}
            >{t(C.REFRESH)}</button>
        </div>
        <div className="p-2 text-center">{status}</div>
        <div className="flex flex-col">
            <table className="table_logs">
                <thead>
                    <tr>{GroupDataSchema.keyof().options.map(key => <th key={key}>{t(key)}</th>)}</tr>
                </thead>
                <tbody>
                    {groups.map(group => (
                        <tr key={group.uno}>
                            {GroupDataSchema.keyof().options.map(column => {
                                const value = group[column]
                                if (!value) {
                                    return <td key={column}>{t(`${C.DATA} ${C.NOT_FOUND}`)}</td>
                                }
                                if (typeof value === 'object') {
                                    return (
                                        <td key={column}>
                                            <button
                                                type="button"
                                                title={t(`open ${column}`)}
                                                onClick={() => modal_open(
                                                    <ShowChoosen stat_data={value} title={column} />
                                                )}
                                            ><IconBook /></button>
                                        </td>
                                    )
                                }
                                return <td key={column}>{value}</td>
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </>
}
