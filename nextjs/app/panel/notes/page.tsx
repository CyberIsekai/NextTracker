'use client'

import {
    useEffect,
    useOptimistic,
    useRef,
    useState,
    useTransition
} from 'react'
import useAppContext from '@/app/components/AppContext'
import {
    IconArrowDown,
    IconArrowDown2,
    IconArrowRight,
    IconArrowUp,
    IconUpdate,
    IconSave,
    IconSuccess,
    IconTrash,
} from '@/app/components/Icons'
import {
    C,
    NAME_LIMIT_2,
} from '@/app/components/Consts'
import {
    get_ago,
    date_epoch,
    fetch_request,
} from '@/app/components/UtilsClient'
import {
    NoteCategories,
    NoteResponse,
    NoteData,
    NoteType,
} from '@/app/components/zod/Note'
import {
    RequestMethod,
    RequestMethodSchema,
} from '@/app/components/zod/Main'

export default function Notes() {
    const { t, modal_open, modal_close } = useAppContext()

    const [, startTransition] = useTransition()
    const status = useRef('')
    const [showCompleted, setShowCompleted] = useState(false)
    const [showCompletedAll, setShowCompletedAll] = useState(false)
    const noteStats = useRef<NoteResponse['stats']>({
        all: 0,
        completed: 0,
        uncompleted: 0,
    })
    const [notes, setNotes] = useState<NoteCategories>({
        completed: [],
        uncompleted: [],
        deleted: []
    })
    const [optimisticNotes, setOptimisticNotes] = useOptimistic<
        { notes: NoteCategories, pending: boolean }, NoteCategories
    >(
        { notes, pending: false },
        (state, notes: NoteCategories) => ({
            ...state,
            notes,
            pending: true
        })
    )

    const fetch_data = async (note_type: NoteType) => {
        const res = await fetch_request<NoteResponse>(`notes/${note_type}`)

        if (!res || res.detail) {
            status.current = res?.detail || `${C.DATA} ${C.NOT_FOUND}`
            return
        }

        noteStats.current = res.stats

        if (note_type === C.ALL) {
            const completed: NoteData[] = []
            const uncompleted: NoteData[] = []
            for (const note of res.notes) {
                if (note.completed) {
                    completed.push(note)
                } else {
                    uncompleted.push(note)
                }
            }
            setNotes(prev => ({ ...prev, completed, uncompleted }))
        } else {
            setNotes(prev => ({ ...prev, [note_type]: res.notes }))
        }
    }

    useEffect(() => {
        fetch_data(C.UNCOMPLETED)
    }, [])

    const notes_manage = async (note: NoteData, method: RequestMethod) => {
        status.current = `${method} [${note.name}]`
        const res = await fetch_request<NoteData>('notes', note, method)
        if (!res || res.detail) {
            status.current = res?.detail || `${C.NOTE} [${note.name}] ${method} ${C.ERROR}`
        } else {
            status.current = ''
            return res
        }
    }

    const notes_search = (target: number | string) => {
        for (const [_, category_notes] of Object.entries(optimisticNotes.notes)) {
            let note: NoteData | undefined
            if (typeof target === 'number') {
                note = category_notes.find(note => note.id === target)
            } else {
                note = category_notes.find(note => note.name === target)
            }

            if (note) {
                const category = _ as keyof typeof optimisticNotes.notes
                return { note, category }
            }
        }
    }

    const notes_post = async (name: string) => {
        if (!name.trim()) return

        // Check if note name in notes
        const found_note = notes_search(name)
        if (found_note) {
            status.current = `${C.NOTE} [${name}] ${C.ALREADY_EXIST} in ${found_note.category} ${C.NOTES}`
            return
        }

        const note: NoteData = {
            id: -1,
            name,
            data: {
                message: '',
                epoch: date_epoch(new Date),
                complete_epoch: 0
            },
            completed: false,
            time: '',
        }

        setOptimisticNotes({
            ...notes,
            uncompleted: [note, ...notes.uncompleted]
        })
        const note_result = await notes_manage(note, RequestMethodSchema.enum.POST)
        if (note_result) {
            setNotes(prev => ({
                ...prev,
                uncompleted: [note_result, ...prev.uncompleted]
            }))
        }
    }

    const notes_delete = async (note_id: number) => {
        const found_note = notes_search(note_id)
        if (!found_note) {
            status.current = `[${note_id}] ${C.NOT_FOUND}`
            return
        }

        const { note, category } = found_note
        const is_deleted = category === C.DELETED

        if (!is_deleted && !confirm(`${t(`${C.DELETE} ${C.NOTE} ?`)} [${note.name}]`)) {
            return // not confirmed delete
        }

        const move_to = !is_deleted ? C.DELETED : note.completed ? C.COMPLETED : C.UNCOMPLETED

        setOptimisticNotes({
            ...notes,
            [category]: notes[category].filter(_note => _note.id !== note.id),
            [move_to]: [note, ...notes[move_to]]
        })

        const note_result = await notes_manage(note, is_deleted ? RequestMethodSchema.enum.POST : RequestMethodSchema.enum.DELETE)

        if (note_result) {
            setNotes(prev => ({
                ...prev,
                [category]: prev[category].filter(_note => _note.id !== note.id),
                [move_to]: [note_result, ...prev[move_to]]
            }))
        }
    }

    const notes_complete = async (note_id: number) => {
        const found_note = notes_search(note_id)
        if (!found_note) {
            status.current = `[${note_id}] ${C.NOT_FOUND}`
            return
        }

        const { note, category } = found_note

        const note_optimistic = {
            ...note,
            completed: !note.completed,
            data: {
                ...note.data,
                complete_epoch: note.completed ? 0 : date_epoch(new Date)
            },
        }

        const move_to = category !== C.UNCOMPLETED ? C.UNCOMPLETED : C.COMPLETED
        setOptimisticNotes({
            ...notes,
            [category]: notes[category].filter(_note => _note.id !== note_optimistic.id),
            [move_to]: [note_optimistic, ...notes[move_to]]
        })

        const note_result = await notes_manage(note_optimistic, RequestMethodSchema.enum.PUT)
        if (note_result) {
            setNotes(prev => ({
                ...prev,
                [category]: prev[category].filter(_note => _note.id !== note_optimistic.id),
                [move_to]: [note_result, ...prev[move_to]]
            }))
        }
    }

    const Note = ({ note }: { note: NoteData }) => (
        <div
            className="
            dropdown p-2 flex max-w-sm rounded-full
            border border-transparent backdrop-blur-sm bg-transparent
            hover:text-gray-300 hover:border-sky-500
            hover:backdrop-blur-xl hover:rounded-md"
        >
            <NoteComplete note={note} />

            <button
                type="button"
                className={`
                p-2 cursor-default break-words decoration-solid
                text-teal-700 leading-relaxed font-medium
                hover:text-sky-300
                ${note.completed ? 'line-through hover:no-underline' : ''}`}
                onClick={() => modal_open(<EditNoteMenu note={note} />)}
            >{note.name}</button>

            {note.completed && <span className="ml-auto"><NoteDelete note_id={note.id} /></span>}

            <div className="popUp -ml-64">
                <p>{note.data.message}</p>
                <p>{get_ago(note.time)}</p>
            </div>
        </div>
    )

    const NoteDelete = ({ note_id }: { note_id: number }) => (
        <button
            type="button"
            className="p-2 text-red-600"
            title={t(`${C.DELETE} ${C.NOTE} ?`)}
            onClick={() => {
                modal_close()
                startTransition(() => notes_delete(note_id))
            }}
        ><IconTrash /></button>
    )

    const NoteComplete = ({ note }: { note: NoteData }) => (
        <button
            type="button"
            className={`w-4 min-w-4
            ${note.completed ? 'text-green-500 hover:text-gray-500'
                    : 'text-gray-500 hover:text-green-500'}`}
            title={t(note.completed ? 'undo complete' : 'complete')}
            onClick={() => {
                modal_close()
                if (!note.completed) setShowCompleted(true)
                startTransition(() => notes_complete(note.id))
            }}
        ><IconSuccess /></button>
    )

    const CompletedNotes = () => (
        <div className="bg-[url('/notes-completed.svg')] bg-fixed bg-contain bg-bottom rounded-lg">
            <div className="p-2 flex sticky-top top-1 m-4">
                <button
                    type="button"
                    className="inline-flex gap-2 mr-2 hover:text-gray-300 disabled:opacity-75"
                    title={t(`${C.COMPLETED} ${C.NOTES}`)}
                    onClick={() => {
                        setShowCompleted(prev => {
                            if (!prev) setShowCompletedAll(false)
                            return !prev
                        })
                        if (optimisticNotes.notes.completed.length < noteStats.current.completed) {
                            fetch_data(C.COMPLETED)
                        }
                    }}
                    disabled={optimisticNotes.pending || !noteStats.current.completed}
                >
                    <span>{showCompleted ? <IconArrowDown2 /> : <IconArrowRight />}</span>
                    <span>{t(`${optimisticNotes.notes.completed.length < noteStats.current.completed
                        ? 'download' : showCompleted ? 'close' : 'open'} ${C.COMPLETED} ${C.NOTES}`)}</span>
                    <span>[{noteStats.current.completed}]</span>
                </button>

                <button
                    type="button"
                    className="ml-auto mr-2 disabled:opacity-75"
                    title={t(`update ${noteStats.current.completed ? C.ALL : C.UNCOMPLETED} ${C.NOTES}`)}
                    onClick={() => fetch_data(noteStats.current.completed ? C.ALL : C.UNCOMPLETED)}
                    disabled={optimisticNotes.pending}
                ><IconUpdate /></button>
            </div>

            {showCompleted && (<>

                <div className="p-2 flex flex-col flex-grow gap-2 mt-4">
                    {(showCompletedAll ? optimisticNotes.notes.completed :
                        optimisticNotes.notes.completed.slice(0, 10)).map(
                            note => <Note key={note.name} note={note} />
                        )}
                </div>

                {(noteStats.current?.completed || 0) > 10 && (
                    <div className="flex justify-center">
                        <button
                            type="button"
                            title={t(showCompletedAll ? 'show more' : 'hide')}
                            className="hover:text-blue-600"
                            onClick={() => setShowCompletedAll(prev => !prev)}
                        >{showCompletedAll ? <IconArrowUp /> : <IconArrowDown />}</button>
                    </div>
                )}
            </>)}
        </div>
    )

    const DeledetNotes = () => {
        if (!optimisticNotes.notes.deleted.length) return null

        return (
            <div>
                <h4 className="p-4">{t(`${C.DELETED} ${C.NOTES}`)}</h4>
                <div className="flex flex-col flex-grow break-all gap-2 mt-4">
                    {optimisticNotes.notes.deleted.map(note => (
                        <button
                            key={note.name}
                            type="button"
                            className={`
                                p-2 break-words decoration-solid text-teal-700
                                leading-relaxed font-medium hover:text-sky-300
                                ${note.completed ? 'line-through hover:no-underline' : ''}`}
                            title={t(`undo ${C.DELETE} ?`)}
                            onClick={() => {
                                modal_close()
                                startTransition(() => notes_delete(note.id))
                            }}
                        >{note.name}</button>
                    ))}
                </div>
            </div>
        )
    }

    const EditNoteMenu = ({ note }: { note: NoteData }) => {
        const edit_note = async (form_data: FormData) => {
            const name = form_data.get(C.NAME)?.toString().trim() || ''
            const message = form_data.get(C.MESSAGE)?.toString().trim() || ''

            if (!name) {
                status.current = `${C.NOTE} ${C.NAME} is empty`
                return
            }
            if (name.length > NAME_LIMIT_2) {
                status.current = `${C.NOTE} ${C.NAME} too long [${name.length}] max length [${NAME_LIMIT_2}]`
                return
            }

            const note_optimistic = {
                ...note,
                name,
                data: {
                    ...note.data,
                    message
                },
            }
            const category = note_optimistic.completed ? C.COMPLETED : C.UNCOMPLETED

            setOptimisticNotes({
                ...notes,
                [category]: [
                    note_optimistic,
                    ...notes[category].filter(_note => _note.id !== note.id)
                ]
            })
            const note_result = await notes_manage(note_optimistic, RequestMethodSchema.enum.PUT)
            setNotes(prev => ({
                ...prev,
                [category]: [
                    note_result,
                    ...prev[category].filter(_note => _note.id !== note.id)
                ]
            }))
        }

        return (
            <div className="w-96 border-2 rounded-md">
                <h4 className="p-2 text-center text-sky-300 text-lg font-bold">
                    {t(`edit ${C.NOTE}`)}
                </h4>
                <form action={format_data => {
                    modal_close()
                    startTransition(() => edit_note(format_data))
                }}>
                    <div className="p-4 flex flex-col justify-center">
                        <input
                            type="text"
                            className="input-note"
                            name={C.NAME}
                            placeholder={t(`add ${C.NAME}`)}
                            defaultValue={note.name}
                            autoFocus={!showCompleted}
                            required
                        />
                        <input
                            type="text"
                            className="input-note"
                            name={C.MESSAGE}
                            placeholder={t(`add ${C.MESSAGE}`)}
                            defaultValue={note.data.message}
                            autoFocus={!showCompleted}
                        />
                    </div>
                    <div className="p-4 flex justify-around">
                        <NoteDelete note_id={note.id} />
                        <NoteComplete note={note} />
                        <button
                            type="submit"
                            title={t(`save ${C.NOTE}`)}
                        ><IconSave /></button>
                    </div>
                </form>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-2 w-96">
            <title>{t(C.NOTES)}</title>
            <div className="bg-[url('/notes-uncompleted.svg')] bg-fixed bg-contain bg-center rounded-lg">
                <div className="p-4">
                    <input
                        type="text"
                        className="input-note pl-4"
                        onKeyDown={e => {
                            if (e.code === 'Enter') {
                                const target = e.target as HTMLInputElement
                                startTransition(() => notes_post(target.value))
                                target.value = ''
                            }
                        }}
                        placeholder={t(optimisticNotes.pending || status.current ? status.current : `${C.NOTE} ${C.NAME}`)}
                        disabled={optimisticNotes.pending}
                        autoFocus={!showCompleted}
                        required
                    />
                </div>

                <div className="p-4 flex flex-col flex-grow gap-2">
                    {optimisticNotes.notes.uncompleted.map(note => <Note key={note.name} note={note} />)}
                </div>
            </div>
            <CompletedNotes />
            <DeledetNotes />
        </div>
    )
}
