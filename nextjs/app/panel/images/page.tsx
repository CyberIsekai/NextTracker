'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import useAppContext from '@/app/components/AppContext'
import FormatedTime from '@/app/components/jsx/FormatedTime'
import { IconGameMode, IconPlus } from '@/app/components/Icons'
import { C } from '@/app/components/Consts'
import {
    ImageData,
    ImageGameMaps,
    ImageGameMap,
    ImageUploadSubmit,
    ImageUpload
} from '@/app/components/zod/Image'
import {
    get_map_img,
    fetch_request,
    get_url
} from '@/app/components/UtilsClient'
import {
    GameMode,
    GAME_MODE_TITLES,
    GameModeOnlySchema,
    GameModeOnly,
    GameModeSchema,
} from '@/app/components/zod/GameMode'
import {
    RequestMethod,
    RequestMethodSchema,
    Message,
} from '@/app/components/zod/Main'

const IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'gif', 'webp'] as const
const IMAGE_FORMATS_REGEX = /\.(jpg|jpeg|png|gif|webp)$/

export default function Images() {
    const { t, profile } = useAppContext()
    const [images, setImages] = useState<ImageGameMaps>()
    const [error, setError] = useState('')
    const [uploadStatus, setUploadStatus] = useState<React.JSX.Element>()
    const [history, setHistory] = useState<React.JSX.Element[]>([])

    const fetch_data = async () => {
        const res = await fetch_request<ImageGameMaps>('images')
        if (!res || res.detail) {
            setError(res?.detail || `${C.DATA} ${C.NOT_FOUND}`)
        } else {
            setImages(res)
        }
    }

    useEffect(() => {
        fetch_data()
    }, [])

    if (error) return <div>{t(error)}</div>
    if (!images) return <div>{`${t(C.LOADING)} ...`}</div>

    const confirm_map_name = (input_name: string) => {
        const name = prompt(t(`confirm map ${C.NAME}`), input_name)
        if (!name?.trim()) {
            setUploadStatus(
                <span className="message-error">
                    {t(`map ${C.NAME} empty`)}
                </span>
            )
        } else if (/\s/g.test(name)) {
            setUploadStatus(
                <span className="message-error">
                    [{name}] {t(`has space in map ${C.NAME}`)}
                </span>
            )
        } else {
            return name.toLowerCase()
        }
    }

    const refresh_session = (last_result?: React.JSX.Element) => {
        if (last_result) {
            setHistory(prev => [last_result, ...prev])
        } else {
            setHistory([])
        }
        setUploadStatus(undefined)
        fetch_data()
    }

    const submit_file = async (image_meta: {
        epoch: number
        name: string
        game_mode: GameMode
    }) => {
        setUploadStatus(<span>{t('submitting')}...</span>)

        const body: ImageUploadSubmit = {
            images: [image_meta.name],
            epoch: image_meta.epoch,
            game_mode: image_meta.game_mode
        }
        const res = await fetch_request<Message>('images/submit', body)

        refresh_session(
            <p
                key={image_meta.epoch}
                className={`p-4 ${res?.message ? 'message-success' : 'message-error'}`}
            >
                {t(res?.message || res?.detail || C.ERROR)}: {body.images.join(', ')}
            </p>
        )
    }

    const image_post = async (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault()

        const file = e.target.files?.item(0)
        if (!file) return

        if (!file.name || !file.name.match(IMAGE_FORMATS_REGEX)) {
            setUploadStatus(
                <span className="message-error">
                    {t('no correct format for')} {file.name}
                    {t('supported formats')}: {IMAGE_FORMATS.join(', ')}
                </span>
            )
            return
        }

        const name = confirm_map_name(file.name.split('.')[0])
        if (!name) return

        const body = new FormData()
        body.append(name, file)

        setUploadStatus(<span>{t('uploading')}...</span>)
        const res = await fetch(
            get_url('images'),
            {
                method: RequestMethodSchema.enum.POST,
                body,
                headers: { token: profile.token },
            }
        )

        if (res.status !== 200) {
            setUploadStatus(
                <span className="message-error">
                    {t(`${C.ERROR} ${C.STATUS}`)}: {res.status}
                </span>
            )
            return
        }

        const data: ImageUpload = await res.json()
        const thumb_image = `data:image/webp;base64,${data.files[0].b64_thumb}`
        const full_image = `data:image/webp;base64,${data.files[0].b64_full}`
        const name_image = data.files[0].name
        const image_meta = {
            epoch: data.epoch,
            name: name_image,
            game_mode: GameModeSchema.parse(e.target.name)
        }

        setUploadStatus(
            <div key={name_image}>
                <p className="text-center">{name_image}</p>
                <a
                    className="cursor-pointer w-auto h-auto"
                    title={`${t('download')} ${name_image} ?`}
                    download={name_image}
                    href={full_image}
                >
                    <Image
                        alt={name_image}
                        src={thumb_image}
                        width={800}
                        height={150}
                    />
                </a>
                <p className="p-4 flex justify-center gap-4">
                    <button
                        type="button"
                        className="link"
                        onClick={() => refresh_session(
                            <p className="p-4 text-red-400">{name_image} {t('was cancel')}</p>
                        )}
                    >{t('cancel')}</button>
                    <button
                        type="button"
                        onClick={() => submit_file(image_meta)}
                        className="link text-white"
                    >{t('confirm')}</button>
                </p>
            </div>
        )
    }

    const manage = async (game_mode: GameMode, name: string, method: RequestMethod, new_name = '') => {
        const title = game_mode === C.ALL ? t(game_mode) : GAME_MODE_TITLES[game_mode]

        if (method === RequestMethodSchema.enum.DELETE && !confirm(`${t(`${method} ${title}`)} ${name} ?`)) {
            return
        }

        if (method === RequestMethodSchema.enum.PUT) {
            const input_name = confirm_map_name(name)
            if (!input_name) return
            new_name = input_name
        }

        const body: ImageData = { name, new_name, game_mode }
        const res = await fetch_request<Message>('images', body, method)

        refresh_session(
            <p key={`${method} ${game_mode}`} className="p-4">
                <span>{t(method)} {title} </span>
                <span>{t(res?.message || res?.detail || `${C.DATA} ${C.NOT_FOUND}`)}</span>
            </p>
        )
    }

    const ShowMap = ({ map, game_mode }: {
        map: ImageGameMap
        game_mode: GameModeOnly
    }) => {
        const [show, setShow] = useState(false)

        return (
            <div className="dropdown">
                <span
                    onMouseOver={() => setShow(true)}
                    className="hover:text-blue-300"
                >{map.name}</span>
                <div className="popUp">
                    <div className="p-4 flex gap-10 justify-center">
                        <span>{t(`map ${C.NAME}`)}: {map.name}</span>
                        <FormatedTime time={map.time} title={t(`${C.TIME} ago`)} />
                        <button
                            type="button"
                            className="link text-amber-500"
                            title={`${t('rename')} ${map.name} ?`}
                            onClick={() => manage(game_mode, map.name, RequestMethodSchema.enum.PUT)}
                        >{t('rename')}</button>
                        <button
                            type="button"
                            className="text-red-500"
                            title={`${t(C.DELETE)} ${map.name} ?`}
                            onClick={() => manage(game_mode, map.name, RequestMethodSchema.enum.DELETE)}
                        >✘</button>
                    </div>
                    {show && (
                        <a
                            href={get_map_img(game_mode, map.name)}
                            title={t('open full resolution')}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Image
                                alt={map.name}
                                src={get_map_img(game_mode, map.name, true)}
                                width={800}
                                height={150}
                            />
                        </a>
                    )}
                </div>
            </div>
        )
    }

    return <>
        <title>{t('images')}</title>

        <div className="flex flex-col justify-center">
            <div className="text-center">
                <button
                    type="button"
                    title={t('refresh maps')}
                    className="link p-4 text-white"
                    onClick={() => refresh_session()}
                >{t(C.REFRESH)}</button>
            </div>
            <div className="text-center">{history}</div>
            <div className="text-center">{uploadStatus}</div>
        </div>
        <div className="flex gap-2">
            {GameModeOnlySchema.options.map(game_mode => (
                <div key={game_mode}>
                    <div className="flex gap-2 items-center">
                        <IconGameMode game_mode={game_mode} />
                        [{images[game_mode].length}]
                        <label className="dropdown cursor-pointer">
                            <IconPlus />
                            <input
                                name={game_mode}
                                type="file"
                                placeholder={t('image')}
                                onChange={image_post}
                                hidden
                            />
                            <span className="popUp">{t(`add ${C.MAP} image`)} {GAME_MODE_TITLES[game_mode]}</span>
                        </label>
                    </div>
                    {images[game_mode].map(map => <ShowMap key={`${game_mode}_${map.name}`} map={map} game_mode={game_mode} />)}
                </div>
            ))}
        </div>
    </>
}
