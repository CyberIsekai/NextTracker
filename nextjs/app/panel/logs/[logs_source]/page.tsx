'use client'

import {
    useEffect,
    useState,
    useRef,
    use,
} from 'react'
import { useInView } from 'react-intersection-observer'
import Link from 'next/link'
import useAppContext from '@/app/components/AppContext'
import FormatedTime from '@/app/components/jsx/FormatedTime'
import { useLogsContext } from '../navigation'
import { IconTrash } from '@/app/components/Icons'
import { fetch_request } from '@/app/components/UtilsClient'
import {
    C,
    TIME_ALERT_2,
} from '@/app/components/Consts'
import {
    log_cache_delete,
    logs_cache_delete,
    logs_cache_get_page,
} from '@/app/components/UtilsBase'
import {
    LogsResponse,
    LogsSource,
    LogsSourceOnly,
    LogsUniversal,
    LogsUniversalAll,
    LogsSearch,
    LogsRequest,
    LogsTracker,
    LogsSourceSchema,
} from '@/app/components/zod/Logs'
import {
    TaskStatusSchema,
    Task,
} from '@/app/components/zod/Task'
import { GAME_MODE_TITLES } from '@/app/components/zod/GameMode'
import {
    Message,
    RequestMethodSchema,
} from '@/app/components/zod/Main'

export default function LogsSourcePage({ params }: {
    params?: Promise<{ logs_source: LogsSource }>
}) {
    const { ref, inView } = useInView()

    const { t } = useAppContext()
    const { tab_update, count } = useLogsContext()

    const [logs, setLogs] = useState<unknown[]>([])
    const [status, setStatus] = useState<React.JSX.Element | null>(null)
    const page = useRef(0)

    const body = params instanceof Promise ? use(params) : params
    const logs_source = LogsSourceSchema.parse(body?.logs_source || C.ALL)
    const is_has_more = logs.length < count

    useEffect(() => {
        if (inView) fetch_data()
    }, [inView])

    const show_message = (message: string, status: 0 | 1) => {
        setStatus(
            <div className={status ? 'message-error' : 'message-success'}>
                {t(message)}
            </div>
        )
        new Promise(r => setTimeout(r, TIME_ALERT_2)).then(() => setStatus(null))
    }

    const refresh = () => {
        setLogs([])
        setStatus(null)
        page.current = 0
    }

    const fetch_data = async () => {
        window.scrollBy(0, -200)
        page.current++

        let page_logs: LogsResponse['logs'] | LogsTracker[] = []

        if (logs_source === 'cod_logs_cache') {
            page_logs = await logs_cache_get_page(logs_source, page.current)
        } else {
            const res = await fetch_request<LogsResponse>(`logs/${logs_source}/${page.current}`)
            if (!res || res.detail) {
                show_message(res?.detail || C.ERROR, 1)
            } else {
                page_logs = res.logs
            }
        }

        setLogs(prev => [...prev, ...page_logs])
    }

    const DeleteLogCache = ({ log }: { log: LogsTracker }) => {
        const log_delete = async () => {
            if (logs_source !== 'cod_logs_cache') return
            if (!confirm(`${t(C.DELETE)} ${log.target} ?`)) return

            try {
                const message = await log_cache_delete(logs_source, log)
                setLogs(prev => prev.filter(_log => (_log as LogsTracker).time !== log.time))
                tab_update(logs_source, -1)
                show_message(message, 0)
            } catch {
                show_message(`${C.DELETE} [${log.target}] ${C.ERROR}`, 1)
            }
        }

        return (
            <button
                type="button"
                title={`${t(C.DELETE)} ${log.target} ?`}
                className="flex m-auto text-red-500"
                onClick={log_delete}
            ><IconTrash /></button>
        )
    }

    const DeleteLog = ({ id, name, log_source }: {
        id: number, name: string, log_source?: LogsSourceOnly
    }) => {
        const source = logs_source === C.ALL ? log_source! : logs_source
        const log_delete = async () => {
            if (!confirm(`${t(C.DELETE)} ${name} ?`)) return

            const res = await fetch_request<Message>(
                `logs/${source}/${id}`, undefined, RequestMethodSchema.enum.DELETE
            )
            if (!res || res.detail) {
                show_message(res?.detail || C.ERROR, 1)
            } else {
                show_message(`log ${C.ID} [${id}] ${t(res.message)}`, 0)
                setLogs(prev => prev.filter(log => (log as LogsResponse['logs'][number]).id !== id))
                tab_update(source, -1)
            }
        }

        return (
            <button
                type="button"
                title={`${t(C.DELETE)} ${name} ?`}
                className="flex m-auto text-red-500"
                onClick={log_delete}
            ><IconTrash /></button>
        )
    }

    const DeleteAllLogs = () => {
        const logs_delete = async () => {
            if (!confirm(`${t(`${C.DELETE} ${C.ALL}`)} ${logs_source} ?`)) return

            let message = ''
            let error = `${C.DELETE} ${C.ALL} [${logs_source}] ${C.ERROR}`

            if (logs_source === 'cod_logs_cache') {
                try {
                    message = await logs_cache_delete(logs_source)
                } catch { }
            } else {
                const res = await fetch_request<Message>(
                    `logs/${logs_source}`, undefined, RequestMethodSchema.enum.DELETE
                )
                if (res?.message) {
                    message = res.message
                } else if (res?.detail) {
                    error = res.detail
                }
            }

            if (message) {
                refresh()
                show_message(message, 0)
                tab_update(logs_source, 0)
            } else {
                show_message(error, 1)
            }
        }

        return (
            <button
                type="button"
                className="text-red-500 hover:text-500/70"
                title={t(`${C.DELETE} ${C.ALL} ${C.LOGS} ?`)}
                onClick={logs_delete}
            >{t(C.DELETE)}</button>
        )
    }

    const LogsSearch = ({ logs }: { logs: LogsSearch[] }) => (
        <table className="table_logs">
            <thead>
                <tr className="sticky-top top-1">
                    <th>[{logs.length}-{count}]</th>
                    <th>{t(C.TARGET)}</th>
                    <th>{t(C.UNO)}</th>
                    <th>{t(C.RESULT)}</th>
                    <th>{t(C.TIME)}</th>
                    <th><DeleteAllLogs /></th>
                </tr>
            </thead>
            <tbody>
                {logs.map(log => (
                    <tr key={`${log.time}_${log.id}`}>
                        <td>{log.id}</td>
                        <td>{log.target}</td>
                        <td>{log.uno}</td>
                        <LogData name={C.RESULT} log={log} title={log.target} />
                        <td><FormatedTime time={log.time} /></td>
                        <td><DeleteLog id={log.id} name={log.target} /></td>
                    </tr>
                ))}
            </tbody>
        </table>
    )

    const LogsRequest = ({ logs }: { logs: LogsRequest[] }) => (
        <table className="table_logs">
            <thead>
                <tr className="sticky-top top-1">
                    <th>[{logs.length}-{count}]</th>
                    <th>{t('client')}</th>
                    <th>{t('path')}</th>
                    <th>{t('user_agent')}</th>
                    <th>{t(C.DATA)}</th>
                    <th>{t(C.TIME)}</th>
                    <th><DeleteAllLogs /></th>
                </tr>
            </thead>
            <tbody>
                {logs.map(log => (
                    <tr key={`${log.time}_${log.id}`}>
                        <td>{log.id}</td>
                        <td>{log.client}</td>
                        <td className="text-left">{log.path}</td>
                        <td className="max-w-2xl">{log.user_agent}</td>
                        <LogData name={C.DATA} log={log} title={log.path} />
                        <td><FormatedTime time={log.time} /></td>
                        <td><DeleteLog id={log.id} name={log.user_agent} /></td>
                    </tr>
                ))}
            </tbody>
        </table>
    )

    const LogsTaskQueues = ({ logs }: { logs: Task[] }) => (
        <table className="table_logs">
            <thead>
                <tr className="sticky-top top-1">
                    <th>[{logs.length}-{count}]</th>
                    <th>{t(C.NAME)}</th>
                    <th>{t(C.STATUS)}</th>
                    <th>{t(`${C.TIME} created`)}</th>
                    <th>{t(`${C.TIME} started`)}</th>
                    <th>{t(`${C.TIME} end`)}</th>
                    <th><DeleteAllLogs /></th>
                </tr>
            </thead>
            <tbody>
                {logs.map(task => (
                    <tr key={`${task.time}_${task.name}`}>
                        <td>{task.id}</td>
                        <td>
                            <div className="dropdown">
                                <span className="text-yellow-400/60">{task.name}</span>
                                <div className="popUp">
                                    <h3 className="basic-title">{t(C.DATA)}</h3>
                                    <p>{task.uno} {task.game_mode} {task.data_type}</p>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>{t(C.NAME)}</th>
                                                <th>{t(C.VALUE)}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(task.data).map(([name, value]) => (
                                                <tr key={`${task.time}_${task.name}_${name}`}>
                                                    <td>{name}</td>
                                                    <td>{value}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </td>
                        <td>
                            <span className={task.status === TaskStatusSchema.enum.PENDING ? 'text-yellow-500' :
                                task.status === TaskStatusSchema.enum.RUNNING ? 'text-green-500' :
                                    task.status === TaskStatusSchema.enum.ERROR ? 'text-red-500' :
                                        'text-white'}>{t(task.status)}</span>
                        </td>

                        <td><FormatedTime time={task.time} /></td>
                        <td>{task.time_started && <FormatedTime time={task.time_started} />}</td>
                        <td>{task.time_end && <FormatedTime time={task.time_end} />}</td>
                        <td><DeleteLog id={task.id} name={task.name} /></td>
                    </tr>
                ))}
            </tbody>
        </table>
    )

    const LogsCache = ({ logs }: { logs: LogsTracker[] }) => (
        <table className="table_logs">
            <thead>
                <tr className="sticky-top top-1">
                    <th>[{logs.length}-{count}]</th>
                    <th>{t(C.TARGET)}</th>
                    <th>{t(C.GAME)}</th>
                    <th>{t(C.MESSAGE)}</th>
                    <th>{t(C.TIME)}</th>
                    <th><DeleteAllLogs /></th>
                </tr>
            </thead>
            <tbody>
                {logs.map((log, index) => (
                    <tr key={`${log.target}_${log.time}`}>
                        <td>{index + 1}</td>
                        <td>{log.target}</td>
                        <td>{log.game_mode && (
                            log.game_mode === C.ALL ? t(log.game_mode) : GAME_MODE_TITLES[log.game_mode]
                        )}</td>
                        <td className="text-left">{log.message}</td>
                        <td><FormatedTime time={log.time} /></td>
                        <td><DeleteLogCache log={log} /></td>
                    </tr>
                ))}
            </tbody>
        </table>
    )

    const LogsBasic = ({ logs }: { logs: LogsUniversal[] }) => (
        <table className="table_logs">
            <thead>
                <tr className="sticky-top top-1">
                    <th>[{logs.length}-{count}]</th>
                    <th>{t(C.TARGET)}</th>
                    <th>{t(C.MESSAGE)}</th>
                    <th>{t(C.TIME)}</th>
                    <th><DeleteAllLogs /></th>
                </tr>
            </thead>
            <tbody>
                {logs.map(log => (
                    <tr key={`${log.target}_${log.time}`}>
                        <td>{log.id}</td>
                        <td>{log.target}</td>
                        {Object.keys(log.data || {}).length ? (
                            <LogData name={log.message} log={log} title={log.target} />
                        ) : (
                            <td className="text-left">{log.message}</td>
                        )}
                        <td><FormatedTime time={log.time} /></td>
                        <td><DeleteLog id={log.id} name={log.target} /></td>
                    </tr>
                ))}
            </tbody>
        </table>
    )

    const LogsBasicAll = ({ logs }: { logs: LogsUniversalAll[] }) => (
        <table className="table_logs">
            <thead>
                <tr className="sticky-top top-1">
                    <th>[{logs.length}-{count}]</th>
                    <th>{t(C.SOURCE)}</th>
                    <th>{t(C.TARGET)}</th>
                    <th>{t(C.MESSAGE)}</th>
                    <th>{t(C.TIME)}</th>
                    <th><DeleteAllLogs /></th>
                </tr>
            </thead>
            <tbody>
                {logs.map((log, index) => (
                    <tr key={`${log.target}_${log.time}`}>
                        <td>{index + 1} [{log.id}]</td>
                        <td>
                            <Link
                                className="link"
                                href={`/panel/logs/${log.source}`}
                            >{log.source}</Link>
                        </td>
                        <td>{log.target}</td>
                        {log.data ? (
                            <LogData name={log.message} log={log} title={log.target} />
                        ) : (
                            <td>{log.message}</td>
                        )}
                        <td><FormatedTime time={log.time} /></td>
                        <td>
                            <DeleteLog
                                id={log.id}
                                name={log.target}
                                log_source={log.source}
                            />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    )

    const ShowTable = () => {
        if (!logs.length) return null
        if ([
            'logs',
            'logs_user',
            'logs_error',
            'logs_ip',
            'logs_url',
            'cod_logs',
            'cod_logs_player',
            'cod_logs_error',
        ].includes(logs_source)) {
            return <LogsBasic logs={logs as LogsUniversal[]} />
        }
        if ([
            'logs_request',
            'logs_request_auth',
            'logs_request_error',
        ].includes(logs_source)) {
            return <LogsRequest logs={logs as LogsRequest[]} />
        }
        if (logs_source === C.ALL) return <LogsBasicAll logs={logs as LogsUniversalAll[]} />
        if (logs_source === 'cod_logs_search') return <LogsSearch logs={logs as LogsSearch[]} />
        if (logs_source === 'cod_logs_cache') return <LogsCache logs={logs as LogsTracker[]} />
        if (logs_source === 'cod_logs_task_queues') return <LogsTaskQueues logs={logs as Task[]} />
        return null
    }

    return (
        <div className="flex flex-col justify-center items-center">
            <button
                type='button'
                className="link p-4"
                onClick={refresh}
            >{t(`refresh ${C.LOGS}`)}</button>
            {status}
            <ShowTable />
            <div className="p-4">
                {is_has_more ? (
                    <button
                        type="button"
                        className="p-8"
                        ref={ref}
                        title={t(`click for load more ${C.LOGS}`)}
                        onClick={fetch_data}
                    >{t('load more')}</button>
                ) : (
                    t(`no more ${C.LOGS}`)
                )}
            </div>
        </div>
    )
}

const LogData = ({ name, log, title }: {
    name: string
    log: LogsResponse['logs'][number]
    title: string
}) => {
    const log_data = structuredClone(log.data)
    let trace = ''
    let text = ''

    if (!Array.isArray(log_data) && typeof log_data.trace === 'string') {
        trace = log_data.trace
        delete log_data.trace
    }
    if (Object.keys(log_data).length) {
        text += JSON.stringify(log_data, null, 4)
        text += '\n\n'
    }

    text += trace

    return (
        <td className="dropdown">
            <span className="text-yellow-400/60">
                {name || JSON.stringify(log.data || '').substring(0, 50)}
            </span>
            <div className="popUp flex flex-col text-2xl">
                <h3 className="basic-title text-3xl text-center">
                    {title}
                </h3>
                <textarea
                    className="p-4 mt-4 rounded bg-gray-800 text-white"
                    // placeholder={t(`log ${C.VALUE}`)}
                    defaultValue={text}
                    rows={9}
                    cols={50}
                />
            </div>
        </td>
    )
}
