'use client'

import Image from 'next/image'
import { C } from '@/app/components/Consts'
import {
  GameMode,
  GAME_MODE_TITLES,
} from '@/app/components/zod/GameMode'

export const IconSpinner = () =>
  <div className="lds-ellipsis">
    <style jsx>{`
    .lds-ellipsis {
        display: inline-block;
        position: relative;
        width: 80px;
        height: 80px;
        text-align: center;
      }
      .lds-ellipsis div {
        position: absolute;
        top: 33px;
        width: 13px;
        height: 13px;
        border-radius: 50%;
        background: #addfdf;
        animation-timing-function: cubic-bezier(0, 1, 1, 0);
      }
      .lds-ellipsis div:nth-child(1) {
        left: 8px;
        animation: lds-ellipsis1 0.6s infinite;
      }
      .lds-ellipsis div:nth-child(2) {
        left: 8px;
        animation: lds-ellipsis2 0.6s infinite;
      }
      .lds-ellipsis div:nth-child(3) {
        left: 32px;
        animation: lds-ellipsis2 0.6s infinite;
      }
      .lds-ellipsis div:nth-child(4) {
        left: 56px;
        animation: lds-ellipsis3 0.6s infinite;
      }
      @keyframes lds-ellipsis1 {
        0% {
          transform: scale(0);
        }
        100% {
          transform: scale(1);
        }
      }
      @keyframes lds-ellipsis3 {
        0% {
          transform: scale(1);
        }
        100% {
          transform: scale(0);
        }
      }
      @keyframes lds-ellipsis2 {
        0% {
          transform: translate(0, 0);
        }
        100% {
          transform: translate(24px, 0);
        }
      }
    `}
    </style>
    <div />
    <div />
    <div />
    <div />
  </div>

export const IconHeadshot = () =>
  <Image
    src="/headshot.webp"
    alt="headshot"
    width={18}
    height={18}
  />

export const IconGameMode = ({ game_mode, size = 32 }: { game_mode: GameMode, size?: number }) => {
  if (game_mode === C.ALL) {
    return <span title={game_mode}>{game_mode}</span>
  }

  const svg_modes: Record<GameMode, React.JSX.Element> = {
    mw_mp: <path
      d="
      M57.56 48.58 41.65 65 25.84 48.58H14.6V79.42h9.83v-19L41.65 78.14
      59.09 60.26V67.5L69 57.36V48.58Zm46 0V67.67L86.2 49.82 69
      67.53v-7L59.09 70.7v8.72h11L86.2 63l16 16.45H113.4V48.58Z"
    />,
    mw_wz: <polygon
      points="
    72.33 93.11 101.99 93.11 103.56 80.98 86.82 80.98 103.72 45.4 103.72
    34.89 74.62 34.89 74.62 34.89 63.16 34.89 60.66 69.41 59.86 69.41
    57.36 34.89 41.47 34.89 39.05 69.41 38.24 69.41 35.74 34.89 24.28
    34.89 24.28 44.99 30.74 93.1 46.55 93.1 49.05 57.77 49.85 57.77
    52.35 93.1 68.17 93.1 73.48 53.52 74.98 41.92 75.74 41.92 76.59
    47.02 89.23 47.02 72.33 82.6 72.33 93.11"
    />,
    cw_mp: (<>
      <path
        d="
          M59.66 75.66q0 7.5-11.28 7.49H17.94V44.85H50.75q8.61
          0 8.62 7.42V57q0 5.64-6.61 6.46 6.9.89 6.9 7.35ZM51.13
          57.47V53.83c0-1.83-1.37-2.75-4.09-2.75H26.7v9.13H47C49.76
          60.21 51.13 59.3 51.13
          57.47Zm.22 15.37v-2.9c0-1.43-.34-2.36-1-2.78a6.31
          6.31 0 0 0-3.3-.64H26.7v9.73H47a6.43 6.43 0 0 0
          3.3-.63C51 75.2 51.35 74.27 51.35 72.84Z"
      />
      <path
        d="
          M110.06 74.1q0 5.34-2 7.2c-1.36 1.24-3.85 1.85-7.46
          1.85H72.35c-3.62 0-6.1-.61-7.47-1.85s-2-3.64-2-7.2V53.9q0-5.34
          2-7.2c1.37-1.24 3.85-1.85 7.47-1.85h28.21c3.61 0 6.1.61
          7.46 1.85s2 3.64 2 7.2ZM101.15 76V51.68H71.75V76Z"
      />
    </>),
    vg_mp: <path
      d="
      M76.63436
      85.52056l33.905-57.79728h-6.28923L76.51762
      75.03541 73.426 69.78251 98.07947
      27.72328H92.00339L70.38182
      64.61009l-3.37265-5.73044L85.27181
      27.72328h-5.915L64.09459
      53.74054 51.66715
      32.64167l-2.897-4.91839H17.46065l2.897
      4.91839 43.737 74.25526
      2.85566-4.86795L26.08052
      32.64167h6.7808L70.33373
      96.26114l.00359.006
      2.92838-4.992-.00359-.006L38.73
      32.64167h6.75826Z"
    />,
    all: <path />
  }

  return (
    <span title={GAME_MODE_TITLES[game_mode]}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        className="p-0 hover:fill-amber-600"
        viewBox="0 0 128 128"
      >{svg_modes[game_mode]}</svg>
    </span>
  )
}


export const IconBlank = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="280"
    height="225"
    className="bg-purple-600"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
  >
    <path d="M21 3H3v18h18V3z" strokeLinecap="round" />
    <path
      d="M16 9c.5523 0 1-.4477 1-1s-.4477-1-1-1-1 .4477-1 1 .4477 1 1 1z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M3 13l5-3 7 5 6-3" strokeLinecap="round" />
  </svg>

export const IconClipBoard = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-6 h-6 text-white hover:text-orange-500"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="
      M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0
      002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424
      48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0
      .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0
      00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0
      1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095
      4.01 8.25 4.973 8.25 6.108V8.25m0
      0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504
      1.125 1.125 1.125h9.75c.621 0 1.125-.504
      1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75
      12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0
      3h.008v.008H6.75V18z"
    />
  </svg>

export const IconCross = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="1.5"
    fill="none"
  >
    <path d="M18 6L6 18M18 18L6 6" strokeLinecap="round" />
  </svg>

export const IconCross1 = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    className="text-white hover:text-yellow-600"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 20L4 4m16 0L4 20" />
  </svg>

export const IconPlus = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 20v-8m0 0V4m0 8h8m-8 0H4" />
  </svg>

export const IconAnimatedSpin = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    fill="currentColor"
    className="mr-2 animate-spin"
    viewBox="0 0 1792 1792"
  >
    <path
      d="
      M526 1394q0 53-37.5 90.5t-90.5 37.5q-52 0-90-38t-38-90q0-53
      37.5-90.5t90.5-37.5 90.5 37.5 37.5 90.5zm498 206q0 53-37.5
      90.5t-90.5 37.5-90.5-37.5-37.5-90.5 37.5-90.5 90.5-37.5
      90.5 37.5 37.5 90.5zm-704-704q0 53-37.5 90.5t-90.5
      37.5-90.5-37.5-37.5-90.5 37.5-90.5 90.5-37.5 90.5
      37.5 37.5 90.5zm1202 498q0 52-38 90t-90 38q-53
      0-90.5-37.5t-37.5-90.5 37.5-90.5 90.5-37.5 90.5
      37.5 37.5 90.5zm-964-996q0 66-47 113t-113
      47-113-47-47-113 47-113 113-47 113 47 47
      113zm1170 498q0 53-37.5 90.5t-90.5
      37.5-90.5-37.5-37.5-90.5 37.5-90.5
      90.5-37.5 90.5 37.5 37.5 90.5zm-640-704q0 80-56
      136t-136 56-136-56-56-136 56-136 136-56 136 56 56
      136zm530 206q0 93-66 158.5t-158 65.5q-93
      0-158.5-65.5t-65.5-158.5q0-92 65.5-158t158.5-66q92
      0 158 66t66 158z"
    />
  </svg>

export const IconSettings = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 7h-9" />
    <path d="M14 17H5" />
    <circle cx="17" cy="17" r="3" />
    <circle cx="7" cy="7" r="3" />
  </svg>

export const IconUpdate1 = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    viewBox="0 0 512 512"
    className="me-1 mr-2"
    height="1em"
    width="1em"
  >
    <path
      d="
      M256.455 8c66.269.119 126.437 26.233 170.859
      68.685l35.715-35.715C478.149 25.851 504
      36.559 504 57.941V192c0 13.255-10.745 24-24
      24H345.941c-21.382
      0-32.09-25.851-16.971-40.971l41.75-41.75c-30.864-28.899-70.801-44.907-113.23-45.273-92.398-.798-170.283
      73.977-169.484 169.442C88.764
      348.009 162.184 424 256 424c41.127 0 79.997-14.678
      110.629-41.556 4.743-4.161 11.906-3.908 16.368.553l39.662
      39.662c4.872 4.872 4.631 12.815-.482 17.433C378.202
      479.813 319.926 504 256 504 119.034 504 8.001 392.967
      8 256.002 7.999 119.193 119.646 7.755 256.455 8z"
    />
  </svg>

export const IconCircleChevronRight = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" /><path d="M10.5 8l4 4-4 4" />
  </svg>

export const IconSearch = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
    data-prefix="fas"
    data-icon="search"
    className="w-4"
    role="img"
    viewBox="0 0 512 512"
  >
    <path
      fill="currentColor"
      d="
      M505 442.7L405.3 343c-4.5-4.5-10.6-7-17-7H372c27.6-35.3
      44-79.7 44-128C416 93.1 322.9 0 208 0S0 93.1 0 208s93.1
      208 208 208c48.3 0 92.7-16.4 128-44v16.3c0 6.4 2.5 12.5
      7 17l99.7 99.7c9.4 9.4 24.6 9.4 33.9 0l28.3-28.3c9.4-9.4
      9.4-24.6.1-34zM208 336c-70.7 0-128-57.2-128-128 0-70.7
      57.2-128 128-128 70.7 0 128 57.2 128 128 0 70.7-57.2
      128-128 128z"
    />
  </svg>

export const IconXCircle = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-6 h-6"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>

export const IconSuccess = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
    data-prefix="fas"
    data-icon="check-circle"
    role="img"
    viewBox="0 0 512 512"
  >
    <path
      fill="currentColor"
      d="
      M504 256c0 136.967-111.033 248-248 248S8 392.967 8 256
      119.033 8 256 8s248 111.033 248 248zM227.314
      387.314l184-184c6.248-6.248 6.248-16.379
      0-22.627l-22.627-22.627c-6.248-6.249-16.379-6.249-22.628
      0L216 308.118l-70.059-70.059c-6.248-6.248-16.379-6.248-22.628
      0l-22.627 22.627c-6.248 6.248-6.248 16.379 0 22.627l104 104c6.249
      6.249 16.379 6.249 22.628.001z"
    />
  </svg>

export const IconCheck = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-6 h-6"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4.5 12.75l6 6 9-13.5"
    />
  </svg>

export const IconUpdate = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-6 h-6"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="
      M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0
      0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0
      0013.803-3.7M4.031 9.865a8.25 8.25 0
      0113.803-3.7l3.181 3.182m0-4.991v4.99"
    />
  </svg>

export const IconSave = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-6 h-6 text-white hover:text-orange-500"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="
      M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652
      2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6
      18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0
      0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25
      2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
    />
  </svg>

export const IconTrash = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-6 h-6"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="
      M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107
      1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244
      2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456
      0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114
      1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5
      0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0
      00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5
      0a48.667 48.667 0 00-7.5 0"
    />
  </svg>

export const IconBook = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-6 h-6"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="
      M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3
      .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6
      2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0
      2.062.18 3 .512v14.25A8.987 8.987 0 0018
      18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
    />
  </svg>

export const IconArrowClockwise = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path
      d="
      M19.734 16.06a8.923 8.923 0 0 1-3.915 3.978 8.706 8.706 0 0
      1-5.471.832 8.795 8.795 0 0 1-4.887-2.64 9.067 9.067 0 0
      1-2.388-5.079 9.136 9.136 0 0 1 1.044-5.53 8.904 8.904 0 0
      1 4.069-3.815 8.7 8.7 0 0 1 5.5-.608c1.85.401 3.366 1.313
      4.62 2.755.151.16.735.806 1.22 1.781"
    />
    <path d="M15.069 7.813l5.04.907L21 3.59" />
  </svg>

export const IconArrowUp = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M17 11l-5-5-5 5M17 18l-5-5-5 5" strokeLinecap="round" />
  </svg>

export const IconArrowUp1 = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    width="36"
    height="36"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M18 15l-6-6-6 6" strokeLinecap="round" />
  </svg>

export const IconArrowDown = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M7 13l5 5 5-5M7 6l5 5 5-5" strokeLinecap="round" />
  </svg>

export const IconArrowDown1 = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    width="36"
    height="36"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M18 10l-6 6-6-6" strokeLinecap="round" />
  </svg>

export const IconArrowDown2 = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-6 h-6"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19.5 8.25l-7.5 7.5-7.5-7.5"
    />
  </svg>

export const IconArrowRight = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-6 h-6"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8.25 4.5l7.5 7.5-7.5 7.5"
    />
  </svg>

export const IconArrowRight1 = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-6 h-6"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8.25 4.5l7.5 7.5-7.5 7.5"
    />
  </svg>

export const IconArrowLeft = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-6 h-6"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 19.5L8.25 12l7.5-7.5"
    />
  </svg>

export const IconArrowLeft1 = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    width="36"
    height="36"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M15 6l-6 6 6 6" strokeLinecap="round" />
  </svg>

export const IconArrowLeft2 = () =>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    shape-rendering="geometricPrecision"
    text-rendering="geometricPrecision"
    image-rendering="optimizeQuality"
    fill-rule="evenodd"
    clip-rule="evenodd"
    viewBox="0 0 415 512.572"
  >
    <path
      fill-rule="nonzero"
      d="
        M106.95 239.595C77.295 203.581 36.099 146.417
        5.112 115.43.484 107.719-.959 99.036.61
        90.977c1.609-8.3 6.324-15.885
        13.944-21.102l2.601-1.589L152.122 0l11.746
        23.296c-12.434 6.292-93.43 46.069-123.485
        61.863 113.328 8.43 202.581 50.998 265.63
        119.244C375.634 279.759 412.909 386.158 415
        512.161l-26.046.411c-1.984-119.466-36.916-219.904-102.142-290.502-59.271-64.155-143.951-103.929-252.057-111.185l92.32
        112.158-20.125 16.552z"
    />
  </svg>
