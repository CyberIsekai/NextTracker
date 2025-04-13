'use client'

import {
    useState,
    useEffect,
    useOptimistic,
    useTransition
} from 'react'
import useAppContext from '@/app/components/AppContext'
import FormatedTime from '@/app/components/jsx/FormatedTime'
import { IconTrash } from '@/app/components/Icons'
import {
    user_authorize,
    user_delete,
    user_edit_email,
    user_edit_language,
    user_edit_roles,
    user_edit_time,
    user_edit_username,
    user_register
} from '@/app/components/UserManage'
import {
    C,
    TIME_ALERT_2,
} from '@/app/components/Consts'
import {
    UserProfile,
    UserRegisterSchema,
} from '@/app/components/zod/User'
import { LanguageSchema, } from '@/app/components/zod/Language'
import { validate_email } from '@/app/components/UtilsValidators'
import {
    get_alert_style,
    local_profile_manage,
} from '@/app/components/UtilsClient'
import {
    MessageStatus,
    MessageStatusSchema,
} from '@/app/components/zod/Main'

export default function UserManager(
    user_profile?: UserProfile,
    roles: string[] = [C.USER, C.ADMIN]
) {
    const { t, set_profile, profile } = useAppContext()

    const [, startTransition] = useTransition()

    const is_guest = profile.login === C.GUEST
    const is_current_user = !user_profile || profile.login === user_profile?.login

    const is_admin = profile.roles.includes(C.ADMIN)

    const [user, setUser] = useState(is_current_user ? profile : user_profile || profile)
    const [optimistic, setOptimistic] = useOptimistic<
        { user: UserProfile, pending: boolean }, UserProfile
    >(
        { user, pending: false },
        (state, user: UserProfile) => ({
            ...state,
            user,
            pending: true
        })
    )

    const login = optimistic.user.login

    const user_update = async (user: UserProfile, func: () => Promise<void>) => {
        if (!is_guest) {
            setOptimistic(user)
            try {
                await func()
            } catch {
                return
            }
        }

        if (is_current_user) {
            set_profile(user, true, false)
        } else {
            setUser(user)
        }
    }

    useEffect(() => {
        if (is_guest || (is_current_user && profile.roles.length)) {
            setUser(profile)
        }
    }, [profile])

    const UserLanguage = () => (
        <label title={t('change_lang')}>
            <select
                className="p-1 text-center text-xs bg-transparent disabled:opacity-75"
                onChange={e => {
                    const language = LanguageSchema.parse(e.target.value)
                    startTransition(() => user_update(
                        { ...user, language },
                        user_edit_language.bind(null, login, language)
                    ))
                }}
                defaultValue={optimistic.user.language}
                disabled={optimistic.pending}
            >
                {LanguageSchema.options.map(language => (
                    <option
                        key={language}
                        title={t(`change_lang ${language}`)}
                        value={language}
                    >{t(language)}</option>
                ))}
            </select>
        </label>
    )

    const UserRole = () => {
        const [showForm, setShowForm] = useState(false)

        if (!showForm) {
            return (
                <button
                    type="button"
                    className="text-stone-400 hover:text-white disabled:opacity-75"
                    title={t(`change ${C.ROLES}`)}
                    onClick={() => setShowForm(true)}
                    disabled={!is_admin || optimistic.pending}
                >
                    {optimistic.user.roles.length ? (
                        <div className="flex flex-col items-start">
                            {optimistic.user.roles.map(role => (
                                <p key={`${login}_${role}`}>
                                    {t(role)}
                                </p>
                            ))}
                        </div>
                    ) : (
                        <span className="text-lg">+</span>
                    )}
                </button>
            )
        }

        const submit_roles = async (form_data: FormData) => {
            const roles = form_data.getAll(C.ROLES) as string[]

            if (JSON.stringify(roles) === JSON.stringify(optimistic.user.roles)) {
                setShowForm(false)
                return
            }

            await user_update(
                { ...user, roles },
                user_edit_roles.bind(null, login, roles)
            )
        }

        return (
            <form>
                <ul>
                    {roles.map(role => (
                        <li key={role}>
                            <label>
                                <input
                                    type="checkbox"
                                    name={C.ROLES}
                                    value={role}
                                    title={t(`change ${C.ROLE} ${role}`)}
                                    defaultChecked={optimistic.user.roles.includes(role)}
                                />
                                {t(role)}
                            </label>
                        </li>
                    ))}
                </ul>
                <button
                    className="p-1 flex m-auto"
                    formAction={submit_roles}
                    disabled={optimistic.pending}
                >✔</button>
            </form >
        )
    }

    const UserDelete = ({ filter_users }: { filter_users?: (login: string) => void }) => {
        const [showForm, setShowForm] = useState(false)
        const [status, setStatus] = useState<React.JSX.Element | null>(null)

        if (status) return status

        if (!showForm) {
            return (
                <button
                    type="button"
                    className="text-red-500 hover:text-white"
                    title={t(`${C.DELETE} ${C.USER} [${login}] ?`)}
                    onClick={() => setShowForm(true)}
                ><IconTrash /></button>
            )
        }

        const submit_delete = async (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault()
            setShowForm(false)

            if (!new FormData(e.target as HTMLFormElement).get(C.DELETE)) return

            setStatus(<span className="message-pending">{t('deleting')}...</span>)

            try {
                await user_delete(login)
                if (filter_users) {
                    filter_users(login)
                }
            } catch {
                setStatus(
                    <span className="message-error">
                        {t(`${C.DELETE} ${C.USER} ${C.ERROR}`)}
                    </span>
                )
                await new Promise(r => setTimeout(r, TIME_ALERT_2))
            }
            setStatus(null)
        }

        return (
            <form className="inline-flex gap-1" onSubmit={submit_delete}>
                <input type="checkbox" name={C.DELETE} title={t(`confirm ${C.DELETE}`)} />
                <button
                    type="submit"
                    className="p-1 flex m-auto"
                >✔</button>
            </form >
        )
    }

    const UserTime = () => {
        const [showForm, setShowForm] = useState(false)
        if (!showForm) {
            return (
                <button
                    type="button"
                    className="text-stone-400 hover:text-white"
                    title={t(`change register ${C.TIME} ?`)}
                    onClick={() => setShowForm(true)}
                    disabled={!is_admin}
                ><FormatedTime time={optimistic.user.time} /></button>
            )
        }

        const default_date = optimistic.user.time.substring(0, 16)

        const submit_time = (form_data: FormData) => {
            setShowForm(false)
            const new_date = form_data.get(C.TIME)?.toString().trim() || null
            if (new_date && default_date !== new_date) {
                user_update(
                    { ...user, time: new_date },
                    user_edit_time.bind(null, login, new Date(new_date))
                )
            }
        }

        return (
            <form className="text-center" action={submit_time}>
                <label className="flex flex-col gap-2">
                    {t(`choose ${C.DATE}`)}
                    <input
                        type="datetime-local"
                        name={C.TIME}
                        className="p-2 bg-gray-800"
                        defaultValue={default_date}
                    />
                </label>
                <button
                    type="submit"
                    className="p-1 flex m-auto"
                    disabled={optimistic.pending}
                >✔</button>
            </form >
        )
    }

    const UserUsername = () => {
        const [showForm, setShowForm] = useState(false)
        const [error, setError] = useState('')

        if (error) {
            new Promise(r => setTimeout(r, TIME_ALERT_2)).then(() => setError(''))
            return (
                <span className="message-error">
                    {t(error)}
                </span>
            )
        }

        if (!showForm) {
            return (
                <button
                    type="button"
                    className={`
                    ${is_current_user ? 'text-amber-500/25' : 'text-stone-500'}
                    hover:text-white disabled:opacity-75`}
                    title={t(`change ${C.USERNAME}`)}
                    onClick={() => setShowForm(true)}
                    disabled={!is_admin}
                >{optimistic.user.username || <span className="text-lg">+</span>}</button>
            )
        }

        const submit_change = async (form_data: FormData) => {
            setShowForm(false)
            const username = form_data.get(C.USERNAME)?.toString().trim() || null

            if (username === optimistic.user.username) return

            if (username === null) {
            } else if (username.length < 4) {
                setError(`${C.USERNAME} too short`)
                return
            } else if (username.length > 30) {
                setError(`${C.USERNAME} too long`)
                return
            }

            user_update(
                { ...user, username },
                user_edit_username.bind(null, login, username)
            )
        }

        return (
            <form className="flex gap-2" action={submit_change}>
                <input
                    type="text"
                    name={C.USERNAME}
                    className="p-1 bg-transparent text-center disabled:opacity-75"
                    title={t(`enter new ${C.USERNAME}`)}
                    placeholder={t(C.USERNAME)}
                    defaultValue={optimistic.user.username || ''}
                />
                <button
                    type="submit"
                    disabled={optimistic.pending}
                >✔</button>
            </form >
        )
    }

    const UserEmail = () => {
        const [showForm, setShowForm] = useState(false)
        const [error, setError] = useState('')

        if (error) {
            new Promise(r => setTimeout(r, TIME_ALERT_2)).then(() => setError(''))
            return (
                <span className="message-error">
                    {t(error)}
                </span>
            )
        }

        if (!showForm) {
            return (
                <button
                    type="button"
                    className={`
                    ${is_current_user ? 'text-amber-500/25' : 'text-stone-500'}
                    hover:text-white disabled:opacity-75`}
                    title={t(`change ${C.EMAIL}`)}
                    onClick={() => setShowForm(true)}
                    disabled={!is_admin}
                >{optimistic.user.email || <span className="text-lg">+</span>}</button>
            )
        }

        const submit_change = async (form_data: FormData) => {
            setShowForm(false)
            const email = form_data.get(C.EMAIL)?.toString().trim() || null

            if (email === optimistic.user.email) return

            if (email !== null && !validate_email(email)) {
                setError(`${C.EMAIL} ${C.NOT_VALID}`)
                return
            }

            user_update(
                { ...user, email },
                user_edit_email.bind(null, login, email)
            )
        }

        return (
            <form className="flex gap-2" action={submit_change}>
                <input
                    type="text"
                    name={C.EMAIL}
                    className="p-1 bg-transparent text-center disabled:opacity-75"
                    title={t(`enter new ${C.USERNAME}`)}
                    placeholder={t(C.USERNAME)}
                    defaultValue={optimistic.user.email || ''}
                />
                <button
                    type="submit"
                    disabled={optimistic.pending}
                >✔</button>
            </form >
        )
    }

    // const ShowUserData = () => {
    //     // const [status, setStatus] = useState<React.JSX.Element | null>(null)

    //     const submit_value = async (form_data: FormData) => {
    //         // let value: Record<string, any>
    //         // if (e.target[0].value?.trim()) {
    //         //     try {
    //         //         value = JSON.parse(e.target[0].value)
    //         //     } catch {
    //         //         setStatus(
    //         //             <span className="message-error">
    //         //                 {t(`${VALUE} ${NOT_VALID}`)}
    //         //             </span>
    //         //         )
    //         //         return
    //         //     }
    //         // } else {
    //         //     value = {}
    //         // }
    //     }

    //     const value = JSON.stringify(user.data, null, 4)

    //     return (
    //         <ModalDialog>
    //             <div className="flex flex-col">
    //                 <h3 className="basic-title text-3xl text-center">
    //                     <span>{t(C.USER)} </span>
    //                     [<span className="text-orange-500">{username}</span>]
    //                     <span> {t(C.DATA)}</span>
    //                 </h3>
    //                 <form action={submit_value}>
    //                     <textarea
    //                         className="p-4 mt-4 rounded bg-gray-800 text-white"
    //                         placeholder={t(`${C.USER} ${C.VALUE}`)}
    //                         defaultValue={value}
    //                         rows={8}
    //                         cols={80}
    //                     />
    //                     <div className="flex items-center">
    //                         {/* <div className="m-auto">{status}</div> */}
    //                         <div className="p-2 flex gap-4 ml-auto">
    //                             <button
    //                                 type="button"
    //                                 title={t('copy')}
    //                                 onClick={() => clipboard(value)}
    //                             ><ClipBoard /></button>
    //                             <button
    //                                 type="submit"
    //                                 title={t('save')}
    //                             ><SaveIcon /></button>
    //                         </div>
    //                     </div>
    //                 </ form>
    //             </div>
    //         </ModalDialog>
    //     )
    // }

    // const UserDataButton = () => (
    //     <button
    //         type="button"
    //         className="text-stone-400 hover:text-white"
    //         title={t(`show ${C.DATA} ?`)}
    //         onClick={() => modal_open()}
    //     ><BookOpen /></button>
    // )

    return {
        UserLanguage,
        UserRole,
        UserDelete,
        UserTime,
        UserUsername,
        UserEmail
    }
}

const UserAuthorizeTabs = () => {
    const { t } = useAppContext()

    const [currentTab, setCurrentTab] = useState<string>(C.LOGIN)
    const [status, setStatus] = useState<React.JSX.Element>()

    const change_status = async (name: string, status: MessageStatus) => {
        setStatus(
            <div className={get_alert_style(status)}>
                {t(name)}
            </div>
        )
        await new Promise(r => setTimeout(r, TIME_ALERT_2))
        setStatus(undefined)
    }

    const tabs: Record<string, React.JSX.Element> = {
        login: <UserLogin change_status={change_status} />,
        registration: <UserRegistration change_status={change_status} />
    }

    return (
        <div className="flex flex-col">
            <div className="p-2 flex gap-4 justify-center text-sky-300 text-lg font-bold">
                {Object.keys(tabs).map(tab_name => (
                    <button
                        key={tab_name}
                        type="button"
                        className={tab_name === currentTab ? 'text-indigo-500' : undefined}
                        disabled={tab_name === currentTab}
                        onClick={() => setCurrentTab(tab_name)}
                    >{t(tab_name)}</button>
                ))}
            </div>
            {status || tabs[currentTab]}
        </div>
    )
}

export const UserStatus = () => {
    const { t, profile, set_profile, modal_open } = useAppContext()
    const {
        UserLanguage, UserRole, UserTime, UserUsername, UserEmail
    } = UserManager()

    return (
        <div className="flex gap-4 justify-center items-center text-gray-200">
            {profile.login === C.GUEST ? (
                <button
                    type="button"
                    onClick={() => modal_open(<UserAuthorizeTabs />)}
                >{t(C.GUEST)}</button>
            ) : <>
                <div className="dropdown">
                    {profile.username || profile.login}
                    <div className="popUp mt-6 -ml-40">
                        <div>{t(C.USERNAME)}: <UserUsername /></div>
                        <div>{t(C.EMAIL)}: <UserEmail /></div>
                        <div>{t(C.ROLES)}: <UserRole /></div>
                        <div>{t(C.TIME)}: <UserTime /></div>
                    </div>
                </div>
                <button
                    type="button"
                    className="link"
                    onClick={() => set_profile(undefined, true, true)}
                >{t('logout')}</button>
            </>}
            <UserLanguage />
        </div >
    )
}

export const UserLogin = ({ change_status }: {
    change_status: (name: string, status: MessageStatus) => Promise<void>
}) => {
    const { t, set_profile, modal_close } = useAppContext()

    const submit_user_login = async (form_data: FormData) => {
        const login = form_data.get(C.LOGIN)?.toString().trim() || null
        const password = form_data.get(C.PASSWORD)?.toString().trim() || null

        if (!login || !password) {
            change_status(`${C.LOGIN} and ${C.PASSWORD} is required`, MessageStatusSchema.enum.ERROR)
            return
        }

        change_status('authorization ...', MessageStatusSchema.enum.MESSAGE)
        const res = await user_authorize(login, password)

        if (typeof res === 'string') {
            change_status(res, MessageStatusSchema.enum.ERROR)
        } else {
            change_status(`[${login}] authorized successfully`, MessageStatusSchema.enum.SUCCESS)
            local_profile_manage(res)
            set_profile(res, true, false)
            modal_close()
        }
    }

    return (
        <form className="flex flex-col">
            <input
                type="text"
                name={C.LOGIN}
                title={t(C.LOGIN)}
                placeholder={`${t(C.LOGIN)} *`}
                className="input-style-1"
                required
            />
            <input
                type="password"
                name={C.PASSWORD}
                title={t(C.PASSWORD)}
                placeholder={`${t(C.PASSWORD)} *`}
                className="input-style-1"
                required
            />
            <button
                formAction={submit_user_login}
                title={t('click for log in')}
                className="button-style-1"
            >{t(C.LOGIN)}</button>
        </form>
    )
}

export const UserRegistration = ({ update_users, change_status }: {
    update_users?: () => void
    change_status?: (name: string, status: MessageStatus) => Promise<void>
}) => {
    const { t, set_profile, profile } = useAppContext()

    const submit_user_register = async (form_data: FormData) => {
        const login = form_data.get(C.LOGIN)?.toString().trim() || null
        const password = form_data.get(C.PASSWORD)?.toString().trim() || null
        const username = form_data.get(C.USERNAME)?.toString().trim() || null
        const email = form_data.get(C.EMAIL)?.toString().trim() || null

        if (!login || !password) {
            if (change_status) {
                change_status(`${C.LOGIN} and ${C.PASSWORD} is required`, MessageStatusSchema.enum.ERROR)
            }
            return
        }

        if (email && !validate_email(email)) {
            if (change_status) {
                change_status(`${C.EMAIL} ${C.NOT_VALID}`, MessageStatusSchema.enum.ERROR)
            }
            return
        }

        if (change_status) {
            change_status(`creating ...`, MessageStatusSchema.enum.MESSAGE)
        }
        const body = UserRegisterSchema.parse({
            login, email, username, password,
            language: profile.language,
            data: {}
        })
        const res = await user_register(body)

        if (typeof res === 'string') {
            if (change_status) {
                change_status(res, MessageStatusSchema.enum.ERROR)
            }
        } else {
            if (change_status) {
                change_status(`[${username || login}] was created`, MessageStatusSchema.enum.SUCCESS)
            }

            if (update_users) {
                update_users()
            } else {
                set_profile(res, true, true)
            }
        }
    }

    return (
        <form className="flex flex-col">
            <input
                type="text"
                name={C.LOGIN}
                title={t(C.LOGIN)}
                placeholder={`${t(C.LOGIN)} *`}
                className="input-style-1"
                required
            />
            <input
                type="password"
                name={C.PASSWORD}
                title={t(C.PASSWORD)}
                placeholder={`${t(C.PASSWORD)} *`}
                className="input-style-1"
                required
            />
            <input
                type="text"
                name={C.USERNAME}
                title={t(C.USERNAME)}
                placeholder={t(C.USERNAME)}
                className="input-style-1"
            />
            <input
                type="email"
                name={C.EMAIL}
                title={t(C.EMAIL)}
                placeholder={t(C.EMAIL)}
                className="input-style-1"
            />
            <button
                formAction={submit_user_register}
                title={t('click for register')}
                className="button-style-1"
            >{t('register')}</button>
        </form>
    )
}
