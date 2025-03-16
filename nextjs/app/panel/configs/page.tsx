'use client'

import { useEffect, useState } from 'react'
import useAppContext from '@/app/components/AppContext'
import FormatedTime from '@/app/components/jsx/FormatedTime'
import {
    IconClipBoard,
    IconSave,
    IconTrash,
    IconUpdate
} from '@/app/components/Icons'
import {
    C,
    NAME_LIMIT,
} from '@/app/components/Consts'
import {
    clipboard,
    fetch_request,
} from '@/app/components/UtilsClient'
import {
    RequestMethod,
    RequestMethodSchema,
} from '@/app/components/zod/Main'
import {
    Config,
    ConfigSchema,
    ConfigSourceSchema,
} from '@/app/components/zod/Config'
import { configs_get } from '@/app/components/UtilsBase'

export default function Configs() {
    const { t, modal_open, modal_close } = useAppContext()

    const [configs, setConfigs] = useState<Config[]>([])
    const [status, setStatus] = useState<React.JSX.Element | null>(null)
    // const [error, setError] = useState('')
    const [fetching, setFetching] = useState(false)

    const fetch_data = async () => {
        setFetching(true)
        const configs = await configs_get()
        setConfigs(configs)
        // const res = await fetch_request<ConfigResponse>('configs')
        // if (!res || res.detail) {
        //     setError(res?.detail || C.ERROR)
        // } else {
        //     setConfigs(res.configs)
        // }
        setFetching(false)
    }

    useEffect(() => {
        fetch_data()
    }, [])

    const manage = async (data: object, method: RequestMethod) => {
        const config = ConfigSchema.parse(data)
        if (method === RequestMethodSchema.enum.DELETE && !confirm(`${t(C.DELETE)} ${C.CONFIG} [${config.name}] ?`)) {
            return
        }
        setFetching(true)
        const res = await fetch_request<Config>('configs', config, method)
        setFetching(false)

        if (!res || res.detail) {
            setStatus(
                <span className="message-error">
                    {t(res?.detail || C.ERROR)}
                </span>
            )
            return
        }

        setStatus(<span className="message-success">{t(method)}</span>)

        if (method === RequestMethodSchema.enum.PUT) {
            setConfigs(prev => {
                prev = prev.filter(_config => _config.id !== config.id)
                prev.push(res)
                return prev.sort((a, b) => a.id - b.id)
            })
        } else if (method === RequestMethodSchema.enum.POST) {
            setConfigs(prev => [...prev, res])
        } else if (method === RequestMethodSchema.enum.DELETE) {
            setConfigs(prev => prev.filter(_config => _config.id !== config.id))
        }

        modal_close()
        setStatus(null)
    }

    const ConfigForm = ({ config_passed }: { config_passed?: Config }) => {
        const config = config_passed || {
            id: -1,
            name: '',
            source: '',
            data: {},
            time: new Date()
        }
        const method: RequestMethod = !config_passed ? RequestMethodSchema.enum.POST : RequestMethodSchema.enum.PUT

        const submit_config = (form_data: FormData) => {

            const source_parsed = ConfigSourceSchema.safeParse(form_data.get(C.SOURCE))
            if (!source_parsed.success) {
                setStatus(
                    <span className="message-error">
                        {t(`${C.CONFIG} ${C.SOURCE} ${C.NOT_VALID}`)}
                    </span>
                )
                return
            }
            const source = source_parsed.data

            const data_input = form_data.get(C.DATA)?.toString().trim() || null
            let data: object
            try {
                data = JSON.parse(data_input || '{/}')
            } catch {
                setStatus(
                    <span className="message-error">
                        {t(`${C.CONFIG} ${C.DATA} ${C.NOT_VALID}`)}
                    </span>
                )
                return
            }

            const name = form_data.get(C.NAME)?.toString().trim() || null
            if (!name || name.length > NAME_LIMIT) {
                setStatus(
                    <span className="message-error">
                        {t(`${C.CONFIG} ${C.NAME} ${C.NOT_VALID}`)}
                    </span>
                )
                return
            }

            if (
                config.name === name &&
                config.source === source &&
                JSON.stringify(config.data) === JSON.stringify(data)
            ) {
                setStatus(
                    <span className="message-error">
                        {t('nothing to save')}
                    </span>
                )
                return
            }

            config.name = name
            config.source = source
            config.data = data

            manage(config, method)
        }

        return (
            <form action={submit_config}>
                <div className="flex flex-col">
                    <h4 className="p-2 flex gap-2 justify-center text-center text-sky-300 text-lg font-bold">
                        <input
                            type="text"
                            name={C.NAME}
                            placeholder={t(C.NAME)}
                            defaultValue={config.name}
                            className="input-style-2 bg-gray-800"
                            autoFocus={true}
                            required
                        />
                        <input
                            type="text"
                            name={C.SOURCE}
                            placeholder={t(C.SOURCE)}
                            defaultValue={config.source}
                            className="input-style-2 bg-gray-800"
                            required
                        />
                    </h4>
                    <textarea
                        name={C.DATA}
                        className="p-4 mt-4 rounded bg-gray-800 text-white"
                        placeholder={t(`${C.CONFIG} ${C.VALUE}`)}
                        defaultValue={JSON.stringify(config.data, null, 4)}
                        rows={8}
                        cols={80}
                    />
                </div>
                <div className="flex items-center">
                    <div className="m-auto">{status}</div>
                    <div className="p-3 flex gap-4 ml-auto">
                        {method === RequestMethodSchema.enum.PUT && (
                            <button
                                type="button"
                                title={t('copy')}
                                onClick={() => clipboard(JSON.stringify(config.data, null, 4))}
                            ><IconClipBoard /></button>
                        )}
                        <button
                            type="submit"
                            title={t('save')}
                            className="disabled:opacity-75"
                            disabled={fetching}
                        ><IconSave /></button>
                    </div>
                </div>
            </ form>
        )
    }

    return <>
        <title>{t(C.CONFIGS)}</title>
        <div className="text-center">
            <button
                type='button'
                className="link text-white disabled:opacity-75"
                title={t(C.REFRESH)}
                onClick={fetch_data}
                disabled={fetching}
            ><IconUpdate /></button>
            {/* <p>{t(error)}</p> */}
        </div>
        <div className="flex flex-col">
            <table className="table_logs">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>{t(C.NAME)}</th>
                        <th>{t(C.SOURCE)}</th>
                        <th>{t(C.TIME)}</th>
                        <th>{t(C.DELETE)}</th>
                    </tr>
                </thead>
                <tbody>
                    {configs.map(config => (
                        <tr
                            key={config.id}
                            className="cursor-pointer"
                            title={t(`open ${C.CONFIG}`)}
                            onClick={() => modal_open(<ConfigForm config_passed={config} />)}
                        >
                            <td>{config.id}</td>
                            <td>{config.name}</td>
                            <td>{config.source}</td>
                            <td><FormatedTime time={config.time.toISOString()} /></td>
                            <td className="text-center">
                                <button
                                    type="button"
                                    className="text-red-600"
                                    title={t(`${C.DELETE} ${C.CONFIG} ?`)}
                                    onClick={() => manage(config, RequestMethodSchema.enum.DELETE)}
                                ><IconTrash /></button>
                            </td>
                        </tr>
                    ))}
                    <tr>
                        <td />
                        <td>
                            <button
                                type="button"
                                onClick={() => modal_open(<ConfigForm />)}
                                title={t(`add new ${C.CONFIG} ?`)}
                            >{t(`add ${C.CONFIG}`)}</button>
                        </td>
                        <td /><td />
                    </tr>
                </tbody>
            </table>
        </div>
    </>
}
