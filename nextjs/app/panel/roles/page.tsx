'use client'

import { useEffect, useState, useRef } from 'react'
import useAppContext from '@/app/components/AppContext'
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
    fetch_request,
    clipboard
} from '@/app/components/UtilsClient'
import {
    RequestMethod,
    RequestMethodSchema,
} from '@/app/components/zod/Main'
import {
    UsersRole,
    UsersRoleResponse,
} from '@/app/components/zod/User'

export default function Roles() {
    const { t, modal_open, modal_close } = useAppContext()

    const [roles, setRoles] = useState<UsersRole[]>([])
    const [error, setError] = useState('')

    const fetch_data = async () => {
        const res = await fetch_request<UsersRoleResponse>('roles')
        if (!res || res.detail) {
            setError(res?.detail || C.ERROR)
        } else {
            setError('')
            setRoles(res.roles)
        }
    }

    useEffect(() => {
        fetch_data()
    }, [])

    const RoleManage = ({ data }: { data?: UsersRole }) => {
        const role = data ? structuredClone(data) : {
            id: -1, name: '', level: 0, pages: [], access: []
        }
        const method: RequestMethod = !data ? RequestMethodSchema.enum.POST : RequestMethodSchema.enum.PUT

        const [status, setStatus] = useState<React.JSX.Element | null>(null)
        const [accessPaths, setAccessPaths] = useState(role.access)
        const newName = useRef(role.name)
        const newPath = useRef('')

        const submit_role = async (form_data: FormData) => {
            const name = form_data.get(C.NAME)?.toString().trim() || null
            const level = +(form_data.get(C.LEVEL) || 0)
            const access = form_data.getAll('access') as string[]
            const pages = form_data.get(C.PAGES)?.toString().trim() || ''

            if (!name || name.length > NAME_LIMIT) {
                setStatus(
                    <span className="message-error">
                        {t(`${C.ROLE} ${C.NAME} ${C.NOT_VALID}`)}
                    </span>
                )
                return
            }

            try {
                role.pages = JSON.parse(pages)
            } catch {
                setStatus(
                    <span className="message-error">
                        {t(`${C.ROLE} ${C.PAGES} ${C.NOT_VALID}`)}
                    </span>
                )
                return
            }

            role.name = name
            role.level = level
            role.access = access

            newName.current = ''
            const message = `${method} ${C.ROLE} [${role.name}]`

            modal_close()
            const res = await fetch_request<UsersRole>('roles', role, method)

            if (!res || res.detail) {
                setError(res?.detail || `${message} ${C.ERROR}`)
                return
            }

            if (method === RequestMethodSchema.enum.PUT) {
                setRoles(prev => {
                    prev = prev.filter(_role => _role.id !== role.id)
                    prev.push(res)
                    return prev.sort((a, b) => a.level - b.level)
                })
            } else {
                setRoles(prev => [...prev, res])
            }
        }

        const NameInput = () => <>
            <p>{t(C.NAME)}</p>
            <input
                type="text"
                className="input-style-2 bg-gray-900"
                name={C.NAME}
                placeholder={t(C.NAME)}
                defaultValue={newName.current}
                onChange={e => newName.current = e.target.value}
                required
            />
        </>

        const LevelInput = () => <>
            <p>{t(C.LEVEL)}</p>
            <input
                type="number"
                name="level"
                className="input-style-2 bg-gray-900"
                placeholder={t(C.LEVEL)}
                defaultValue={role.level}
            />
        </>

        const PagesInput = () => <>
            <div className="p-2 flex items-center gap-2">
                <p>{t(C.PAGES)} [{role.pages.length}]</p>
                <button
                    type="button"
                    title={t(`copy ${C.PAGES}`)}
                    onClick={() => clipboard(JSON.stringify(role.pages, null, 4))}
                ><IconClipBoard /></button>
            </div>
            <textarea
                name={C.PAGES}
                className="p-4 w-full bg-gray-900"
                placeholder={t(`${C.ROLE} ${C.PAGES}`)}
                defaultValue={JSON.stringify(role.pages, null, 4)}
                rows={8}
                cols={80}
            />
        </>

        const AccessPaths = () => {
            const submit_new_paths = () => {
                const new_path = newPath.current.trim().toLowerCase()
                newPath.current = ''
                if (new_path && !accessPaths.includes(new_path)) {
                    setAccessPaths(prev => [...prev, new_path])
                }
            }

            return <>
                <h3 className="basic-title text-center text-2xl">
                    {t('access paths')} [{accessPaths.length}] {' '}
                </h3>
                <div className="flex justify-center items-center gap-2">
                    <input
                        type="text"
                        className="input-style-2 bg-gray-900"
                        title={t('add new paths')}
                        onChange={e => newPath.current = e.target.value}
                        placeholder={t('add new paths')}
                    />
                    <button
                        type="button"
                        className="text-white text-4xl hover:text-blue-500"
                        title={t('confirm new paths')}
                        onClick={submit_new_paths}
                    >✔</button>
                </div>
                <ul className="grid grid-cols-4 bg-gray-900">
                    {accessPaths.map(path => (
                        <li key={path}>
                            <label className="p-1 flex gap-1">
                                <input
                                    type="checkbox"
                                    name="access"
                                    value={path}
                                    title={t('change access path')}
                                    defaultChecked={true}
                                />
                                {path}
                            </label>
                        </li>
                    ))}
                </ul>
            </>
        }

        return (
            <form
                className="
                p-4 flex flex-col items-center gap-1
                text-white bg-gray-800 rounded"
                action={submit_role}
            >
                <NameInput />
                <LevelInput />
                <PagesInput />
                <AccessPaths />
                {status}
                <button
                    type="submit"
                    title={t(`save ${C.ROLE}`)}
                    className="p-2"
                ><IconSave /></button>
            </form>
        )
    }

    const roles_delete = async (role: UsersRole) => {
        const message = `${C.DELETE} ${C.ROLE} [${role.name}]`

        if (!confirm(`${t(message)} ?`)) return

        const res = await fetch_request<UsersRole>('roles', role, RequestMethodSchema.enum.DELETE)

        if (!res || res.detail) {
            setError(t(res?.detail || `${message} ${C.ERROR}`))
        } else {
            setRoles(prev => prev.filter(_role => _role.id !== role.id))
        }
    }

    return <>
        <title>{t(C.ROLES)}</title>
        <div className="text-center">
            <button
                type='button'
                className="link text-white disabled:opacity-75"
                title={t(C.REFRESH)}
                onClick={fetch_data}
            ><IconUpdate /></button>
            <p className="message-error">{t(error)}</p>
        </div>

        <table className="table_logs">
            <thead>
                <tr>
                    <th>{t(C.NAME)}</th>
                    <th>{t(C.LEVEL)}</th>
                    <th>{t(C.PAGES)}</th>
                    <th>{t('access')}</th>
                    <th>{t(C.DELETE)}</th>
                </tr>
            </thead>
            <tbody>
                {roles.map(role => (
                    <tr key={role.name}>
                        <td>
                            <button
                                type="button"
                                className="text-yellow-700 hover:text-current"
                                title={t(`open ${C.ROLE}`)}
                                onClick={() => modal_open(<RoleManage data={role} />)}
                            >{role.name}</button>
                        </td>
                        <td>{role.level}</td>
                        <td>
                            <div className="max-w-md break-words">
                                {role.pages.map(page => page.name).join(', ')}
                            </div>
                        </td>
                        <td>
                            <div className="max-w-md break-words">
                                {role.access.join(', ')}
                            </div>
                        </td>
                        <td className="text-center">
                            <button
                                type="button"
                                className="text-red-600"
                                title={t(`${C.DELETE} ${C.ROLE} ?`)}
                                onClick={() => roles_delete(role)}
                            ><IconTrash /></button>
                        </td>
                    </tr>
                ))}
                <tr>
                    <td>
                        <button
                            type="button"
                            onClick={() => modal_open(<RoleManage />)}
                            title={t(`add new ${C.ROLE} ?`)}
                        >{t(`add ${C.ROLE}`)}</button>
                    </td>
                    <td /><td /><td /><td />
                </tr>
            </tbody>
        </table>
    </>
}
