'use client'

import { useEffect, useState } from 'react'
import useAppContext from '@/app/components/AppContext'
import UserManager, { UserRegistration } from '@/app/components/UserManager'
import { fetch_request } from '@/app/components/UtilsClient'
import { C } from '@/app/components/Consts'
import {
    UserProfile,
    UsersResponse,
} from '@/app/components/zod/User'

export default function Users() {
    const { t, modal_open, modal_close } = useAppContext()

    const [data, setData] = useState<UsersResponse>()
    const [error, setError] = useState('')

    const fetch_data = async () => {
        const res = await fetch_request<UsersResponse>('users')
        if (!res || res.detail) {
            setError(res?.detail || `${C.DATA} ${C.NOT_FOUND}`)
        } else {
            setError('')
            setData(res)
        }
    }

    const update_users = async () => {
        fetch_data()
        modal_close()
    }

    useEffect(() => {
        fetch_data()
    }, [])

    if (error) {
        return (
            <div className="p-4 text-center">
                <p>{t(error)}</p>
                <button
                    type="button"
                    className="link"
                    onClick={fetch_data}
                >{t(C.REFRESH)}</button>
            </div>
        )
    }
    if (!data) return <div>{t(C.LOADING)}...</div>

    const filter_users = (login: string) => {
        setData(prev => {
            if (!prev) return
            prev.users = prev.users.filter(user => user.login !== login)
            return { ...prev }
        })
    }

    const UserRow = ({ user_data }: { user_data: UserProfile }) => {
        const {
            UserLanguage, UserRole, UserDelete, UserTime, UserUsername, UserEmail
        } = UserManager(user_data, data.roles)

        return (
            <tr>
                <td>{user_data.login}</td>
                <td><UserUsername /></td>
                <td><UserEmail /></td>
                <td><UserLanguage /></td>
                <td><UserRole /></td>
                <td><UserTime /></td>
                <td className="text-center"><UserDelete filter_users={filter_users} /></td>
            </tr>
        )
    }

    return <>
        <title>{t(C.USERS)}</title>
        <div className="p-4 text-center">
            <button
                type="button"
                className="link"
                onClick={fetch_data}
            >{t(C.REFRESH)}</button>
        </div>
        <table className="table_logs">
            <thead className="sticky-top top-2">
                <tr>
                    <th>{t(C.LOGIN)}</th>
                    <th>{t(C.USERNAME)}</th>
                    <th>{t(C.EMAIL)}</th>
                    <th>{t(C.LANGUAGE)}</th>
                    <th>{t(C.ROLES)}</th>
                    <th>{t(C.TIME)}</th>
                    <th>{t(C.DELETE)}</th>
                </tr>
            </thead>
            <tbody>
                {data.users.map(user => <UserRow key={user.login} user_data={user} />)}
                <tr>
                    <td className="text-center">
                        <button
                            type="button"
                            onClick={() => modal_open(<UserRegistration update_users={update_users} />)}
                        >+</button>
                    </td>
                </tr>
            </tbody>
        </table>
    </>
}
