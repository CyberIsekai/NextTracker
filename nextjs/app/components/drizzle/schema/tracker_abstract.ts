import {
    serial,
    varchar,
    timestamp,
    doublePrecision,
    smallint,
    integer,
    bigint,
} from 'drizzle-orm/pg-core'
import {
    C,
    NAME_LIMIT,
    NAME_LIMIT_2,
} from '@/app/components/Consts'
import { PlayerUno } from '@/app/components/zod/Uno'
import { MatchID, MatchResult } from '@/app/components/zod/Match'

export const all_games_basic_indexes = [C.ID, C.TIME, C.MATCHID, C.UNO]
export const matches_basic_indexes = [
    ...all_games_basic_indexes,
    C.DURATION, C.TIME_PLAYED, C.KILLS, C.DEATHS, C.KDRATIO,
    'damageDone', C.HEADSHOTS, 'longestStreak',
    'assists', 'score', 'scorePerMinute', 'totalXp'
]
export const matches_basic_mw_indexes = [
    ...matches_basic_indexes, C.USERNAME, C.CLANTAG
]

export const cod_label = () => ({
    id: serial(C.ID).primaryKey().unique().notNull(),
    name: varchar(C.NAME, { length: NAME_LIMIT_2 }).unique().notNull(),
    label: varchar(C.LABEL, { length: NAME_LIMIT_2 }),
    game_mode: varchar(C.GAME_MODE, { length: NAME_LIMIT }),
    time: timestamp(C.TIME).defaultNow().notNull(),
})

export const all_games_basic = () => ({
    id: serial(C.ID).primaryKey().unique().notNull(),
    time: timestamp(C.TIME).notNull(),
    matchID: varchar(C.MATCHID, { length: NAME_LIMIT_2 }).$type<MatchID>().notNull(),
    uno: varchar(C.UNO, { length: NAME_LIMIT_2 }).$type<PlayerUno>().notNull(),
    map: varchar('map', { length: NAME_LIMIT_2 }),
    mode: varchar(C.MODE, { length: NAME_LIMIT_2 }),
    team: varchar(C.TEAM, { length: 60 }),
    result: smallint(C.RESULT).$type<MatchResult>().default(0).notNull(),
})

export const matches_basic = () => ({
    ...all_games_basic(),
    duration: integer(C.DURATION).default(0).notNull(),
    timePlayed: integer(C.TIME_PLAYED).default(0).notNull(),
    kills: smallint(C.KILLS).default(0).notNull(),
    deaths: smallint(C.DEATHS).default(0).notNull(),
    kdRatio: doublePrecision(C.KDRATIO).default(0).notNull(),
    damageDone: bigint('damageDone', { mode: 'number' }).default(0).notNull(),
    headshots: smallint(C.HEADSHOTS).default(0).notNull(),
    longestStreak: smallint('longestStreak').default(0).notNull(),
    assists: smallint('assists').default(0).notNull(),
    score: integer('score').default(0).notNull(),
    scorePerMinute: doublePrecision('scorePerMinute').default(0).notNull(),
    totalXp: integer('totalXp').default(0).notNull(),
})

export const fullmatches_basic = () => ({
    ...matches_basic(),

    username: varchar(C.USERNAME, { length: NAME_LIMIT_2 }),
    clantag: varchar(C.CLANTAG, { length: 60 }),
})

export const basic_mw = () => ({
    ...matches_basic(),

    username: varchar(C.USERNAME, { length: NAME_LIMIT_2 }),
    clantag: varchar(C.CLANTAG, { length: 60 }),

    medalXp: integer('medalXp'),
    matchXp: integer('matchXp'),
    scoreXp: integer('scoreXp'),
    wallBangs: smallint('wallBangs'),
    rank: smallint('rank'),
    distanceTraveled: integer('distanceTraveled'),
    executions: smallint('executions'),
    nearmisses: smallint('nearmisses'),
    percentTimeMoving: doublePrecision('percentTimeMoving'),
    miscXp: integer('miscXp'),

    damageTaken: bigint('damageTaken', { mode: 'number' }),
    loadout: varchar(C.LOADOUT),

    objectiveMedalScoreKillSsAssaultDrone: smallint('objectiveMedalScoreKillSsAssaultDrone'),
    objectiveMedalScoreKillSsManualTurret: smallint('objectiveMedalScoreKillSsManualTurret'),
    objectiveMedalScoreKillSsRadarDrone: smallint('objectiveMedalScoreKillSsRadarDrone'),
    objectiveMedalScoreKillSsHoverJet: smallint('objectiveMedalScoreKillSsHoverJet'),
    objectiveMedalScoreKillSsSentryGun: smallint('objectiveMedalScoreKillSsSentryGun'),
    objectiveMedalScoreKillSsScramblerDrone: smallint('objectiveMedalScoreKillSsScramblerDrone'),
    objectiveMedalScoreSsKillAssaultDrone: smallint('objectiveMedalScoreSsKillAssaultDrone'),
    objectiveMedalScoreSsKillSentryGun: smallint('objectiveMedalScoreSsKillSentryGun'),
    objectiveMedalScoreSsKillPrecisionAirstrike: smallint('objectiveMedalScoreSsKillPrecisionAirstrike'),
    objectiveMedalScoreSsKillTomaStrike: smallint('objectiveMedalScoreSsKillTomaStrike'),
    objectiveMedalScoreSsKillJuggernaut: smallint('objectiveMedalScoreSsKillJuggernaut'),
    objectiveMedalScoreSsKillManualTurret: smallint('objectiveMedalScoreSsKillManualTurret'),
    objectiveDestroyedVehicleHeavy: smallint('objectiveDestroyedVehicleHeavy'),
    objectiveDestroyedVehicleLight: smallint('objectiveDestroyedVehicleLight'),
    objectiveDestroyedVehicleMedium: smallint('objectiveDestroyedVehicleMedium'),
    objectiveDestroyedTacInsert: smallint('objectiveDestroyedTacInsert'),
    objectiveDestroyedEquipment: smallint('objectiveDestroyedEquipment'),
    objectiveMedalModeXAssaultScore: smallint('objectiveMedalModeXAssaultScore'),
    objectiveMedalModeDomSecureAssistScore: smallint('objectiveMedalModeDomSecureAssistScore'),
    objectiveManualFlareMissileRedirect: smallint('objectiveManualFlareMissileRedirect'),
    objectiveAssistDecoy: smallint('objectiveAssistDecoy'),
    objectiveEmpedPlayer: smallint('objectiveEmpedPlayer'),
    objectiveEmpedVehicle: smallint('objectiveEmpedVehicle'),
    objectivePerkMarkedTarget: smallint('objectivePerkMarkedTarget'),
    objectiveReviver: smallint('objectiveReviver'),
    objectiveRadarDroneReconAssist: smallint('objectiveRadarDroneReconAssist'),
    objectiveRadarDroneReconEnemyMarked: smallint('objectiveRadarDroneReconEnemyMarked'),
    objectiveShieldDamage: smallint('objectiveShieldDamage'),
    objectiveShieldAssist: smallint('objectiveShieldAssist'),
    objectiveTrophyDefense: smallint('objectiveTrophyDefense'),
    objectiveHack: smallint('objectiveHack'),
    objectiveTagCollected: smallint('objectiveTagCollected'),
    objectiveTagDenied: smallint('objectiveTagDenied'),
    objectiveMunitionsBoxTeammateUsed: smallint('objectiveMunitionsBoxTeammateUsed'),
    objectiveWeaponDropTeammateUsed: smallint('objectiveWeaponDropTeammateUsed'),
    objectiveScrapAssist: smallint('objectiveScrapAssist'),
})

export const matches_mw_mp = () => ({
    ...basic_mw(),

    accuracy: doublePrecision(C.ACCURACY),
    averageSpeedDuringMatch: doublePrecision('averageSpeedDuringMatch'),
    shotsLanded: smallint('shotsLanded'),
    shotsMissed: smallint('shotsMissed'),
    suicides: smallint('suicides'),
    seasonRank: smallint('seasonRank'),
    shotsFired: smallint('shotsFired'),
    team1Score: smallint('team1Score'),
    team2Score: smallint('team2Score'),
    weaponStats: varchar('weaponStats'),

    objectiveBrDoomstationActivation: smallint('objectiveBrDoomstationActivation'),
    objectiveBrDoomstationSuccess: smallint('objectiveBrDoomstationSuccess'),
    objectiveBrVillainContribution: smallint('objectiveBrVillainContribution'),
    objectiveBrHeroContribution: smallint('objectiveBrHeroContribution'),
    objectiveMedalScoreKillApcRus: smallint('objectiveMedalScoreKillApcRus'),
    objectiveMedalScoreKillSsUav: smallint('objectiveMedalScoreKillSsUav'),
    objectiveMedalScoreKillSsGunship: smallint('objectiveMedalScoreKillSsGunship'),
    objectiveMedalScoreKillSsBradley: smallint('objectiveMedalScoreKillSsBradley'),
    objectiveMedalScoreKillSsChopperGunner: smallint('objectiveMedalScoreKillSsChopperGunner'),
    objectiveMedalScoreKillSsFuelAirstrike: smallint('objectiveMedalScoreKillSsFuelAirstrike'),
    objectiveMedalScoreKillSsPacSentry: smallint('objectiveMedalScoreKillSsPacSentry'),
    objectiveMedalScoreSsKillBradley: smallint('objectiveMedalScoreSsKillBradley'),
    objectiveMedalScoreSsKillChopperSupport: smallint('objectiveMedalScoreSsKillChopperSupport'),
    objectiveMedalScoreSsKillChopperGunner: smallint('objectiveMedalScoreSsKillChopperGunner'),
    objectiveMedalScoreSsKillWhitePhosphorus: smallint('objectiveMedalScoreSsKillWhitePhosphorus'),
    objectiveMedalScoreSsKillGunship: smallint('objectiveMedalScoreSsKillGunship'),
    objectiveMedalScoreSsKillPacSentry: smallint('objectiveMedalScoreSsKillPacSentry'),
    objectiveMedalScoreSsKillCruisePredator: smallint('objectiveMedalScoreSsKillCruisePredator'),
    objectiveMedalScoreSsKillHoverJet: smallint('objectiveMedalScoreSsKillHoverJet'),
    objectiveMedalModeArmSecureMidScore: smallint('objectiveMedalModeArmSecureMidScore'),
    objectiveMedalModeArmSecureOuterMidScore: smallint('objectiveMedalModeArmSecureOuterMidScore'),
    objectiveMedalModeArmSecureOuterScore: smallint('objectiveMedalModeArmSecureOuterScore'),
    objectiveMedalModeDomSecureNeutralScore: smallint('objectiveMedalModeDomSecureNeutralScore'),
    objectiveMedalModeDomSecureScore: smallint('objectiveMedalModeDomSecureScore'),
    objectiveMedalModeDomSecureBScore: smallint('objectiveMedalModeDomSecureBScore'),
    objectiveMedalModeDomSecureNeutralilizedScore: smallint('objectiveMedalModeDomSecureNeutralilizedScore'),
    objectiveMedalModeSdPlantSaveScore: smallint('objectiveMedalModeSdPlantSaveScore'),
    objectiveMedalModeSdDefuseScore: smallint('objectiveMedalModeSdDefuseScore'),
    objectiveMedalModeSdDefuseSaveScore: smallint('objectiveMedalModeSdDefuseSaveScore'),
    objectiveMedalModeSdDetonateScore: smallint('objectiveMedalModeSdDetonateScore'),
    objectiveMedalModeSdLastDefuseScore: smallint('objectiveMedalModeSdLastDefuseScore'),
    objectiveMedalModeSiegeSecureScore: smallint('objectiveMedalModeSiegeSecureScore'),
    objectiveMedalModeCyberKillCarrierScore: smallint('objectiveMedalModeCyberKillCarrierScore'),
    objectiveMedalModeHpSecureScore: smallint('objectiveMedalModeHpSecureScore'),
    objectiveMedalModeHpSecureReducedScore: smallint('objectiveMedalModeHpSecureReducedScore'),
    objectiveMedalModeCtfCapScore: smallint('objectiveMedalModeCtfCapScore'),
    objectiveMedalModeCtfKillCarrierScore: smallint('objectiveMedalModeCtfKillCarrierScore'),
    objectiveMedalModeXDefendScore: smallint('objectiveMedalModeXDefendScore'),
    objectiveMedalModeKcOwnTagsScore: smallint('objectiveMedalModeKcOwnTagsScore'),
    objectiveKillBonus: smallint('objectiveKillBonus'),
    objectiveKillDenied: smallint('objectiveKillDenied'),
    objectiveKillConfirmed: smallint('objectiveKillConfirmed'),
    objectiveKillstreakFullScore: smallint('objectiveKillstreakFullScore'),
    objectiveKillJuggernaut: smallint('objectiveKillJuggernaut'),
    objectiveKillAsJuggernaut: smallint('objectiveKillAsJuggernaut'),
    objectiveGrndInObj: smallint('objectiveGrndInObj'),
    objectiveRugbyObjPush: smallint('objectiveRugbyObjPush'),
    objectivePlant: smallint('objectivePlant'),
    objectiveLastManKill: smallint('objectiveLastManKill'),
    objectiveDirectionalUavAssist: smallint('objectiveDirectionalUavAssist'),
    objectiveDisabledVehicleLight: smallint('objectiveDisabledVehicleLight'),
    objectiveDisabledVehicleMedium: smallint('objectiveDisabledVehicleMedium'),
    objectiveDisabledVehicleHeavy: smallint('objectiveDisabledVehicleHeavy'),
    objectiveDroppedGunRank: smallint('objectiveDroppedGunRank'),
    objectiveDzCapture: smallint('objectiveDzCapture'),
    objectiveWhitePhosphorusAssist: smallint('objectiveWhitePhosphorusAssist'),
    objectiveTdefHoldObj: smallint('objectiveTdefHoldObj'),
    objectiveCarrierBonus: smallint('objectiveCarrierBonus'),
    objectiveFlagGrab: smallint('objectiveFlagGrab'),
    objectiveFlagReturn: smallint('objectiveFlagReturn'),
    objectiveFirstInfected: smallint('objectiveFirstInfected'),
    objectiveHijacker: smallint('objectiveHijacker'),
    objectiveCaptureKill: smallint('objectiveCaptureKill'),
    objectiveUavAssist: smallint('objectiveUavAssist'),
    objectiveKcFriendlyPickup: smallint('objectiveKcFriendlyPickup'),
    objectiveObjProgDefend: smallint('objectiveObjProgDefend'),
    objectiveMegaBank: smallint('objectiveMegaBank'),
    objectiveGrindFriendlyPickup: smallint('objectiveGrindFriendlyPickup'),
    objectiveTagScore: smallint('objectiveTagScore'),
    objectiveKothInObj: smallint('objectiveKothInObj'),
    objectiveEmpGrab: smallint('objectiveEmpGrab'),
    objectiveExecution: smallint('objectiveExecution'),
    objectiveGainedGunRank: smallint('objectiveGainedGunRank'),
    objectiveSquadSpawnSelf: smallint('objectiveSquadSpawnSelf'),
    objectiveSquadSpawn: smallint('objectiveSquadSpawn'),
    objectiveScramblerDroneGuardAssist: smallint('objectiveScramblerDroneGuardAssist'),
    objectiveSnowballKill: smallint('objectiveSnowballKill'),
    objectiveSurvivor: smallint('objectiveSurvivor'),
    objectiveFinalSurvivor: smallint('objectiveFinalSurvivor'),
    objectiveInfectedSurvivor: smallint('objectiveInfectedSurvivor'),
})

export const matches_mw_wz = () => ({
    ...basic_mw(),

    teamCount: smallint('teamCount'),
    teamSurvivalTime: integer('teamSurvivalTime'),
    bonusXp: integer('bonusXp'),
    challengeXp: integer('challengeXp'),
    gulagDeaths: smallint('gulagDeaths'),
    gulagKills: smallint('gulagKills'),
    playerCount: smallint('playerCount'),

    objectiveBinocularsAssist: smallint('objectiveBinocularsAssist'),
    objectiveBinocularsMarked: smallint('objectiveBinocularsMarked'),
    objectiveEnemyWiped: smallint('objectiveEnemyWiped'),
    objectiveTeamWiped: smallint('objectiveTeamWiped'),
    objectiveLastStandKill: smallint('objectiveLastStandKill'),
    objectivePlunderCashBloodMoney: smallint('objectivePlunderCashBloodMoney'),

    objectiveBrArmoryTraderUse: smallint('objectiveBrArmoryTraderUse'),
    objectiveBrCommTowerActivated: smallint('objectiveBrCommTowerActivated'),
    objectiveBrC130BoxOpen: smallint('objectiveBrC130BoxOpen'),
    objectiveBrCacheOpen: smallint('objectiveBrCacheOpen'),
    objectiveBrDownEnemyCircle1: smallint('objectiveBrDownEnemyCircle1'),
    objectiveBrDownEnemyCircle2: smallint('objectiveBrDownEnemyCircle2'),
    objectiveBrDownEnemyCircle3: smallint('objectiveBrDownEnemyCircle3'),
    objectiveBrDownEnemyCircle4: smallint('objectiveBrDownEnemyCircle4'),
    objectiveBrDownEnemyCircle5: smallint('objectiveBrDownEnemyCircle5'),
    objectiveBrDownEnemyCircle6: smallint('objectiveBrDownEnemyCircle6'),
    objectiveBrLootChopperBoxOpen: smallint('objectiveBrLootChopperBoxOpen'),
    objectiveBrGametypeBodycountFinalKill: smallint('objectiveBrGametypeBodycountFinalKill'),
    objectiveBrMissionPickupTablet: smallint('objectiveBrMissionPickupTablet'),
    objectiveBrKioskBuy: smallint('objectiveBrKioskBuy'),
    objectiveBrRogueCacheOpen: smallint('objectiveBrRogueCacheOpen'),
    objectiveBrSupplySweepAssist: smallint('objectiveBrSupplySweepAssist'),

    objectiveBrPerseusLockerDoorOpenEe: smallint('objectiveBrPerseusLockerDoorOpenEe'),
    objectiveBrForgottenLockerDoorOpenEe: smallint('objectiveBrForgottenLockerDoorOpenEe'),
    objectiveBrVikhorLockerDoorOpenEe: smallint('objectiveBrVikhorLockerDoorOpenEe'),
    objectiveBrBunkerDoorOpenEe: smallint('objectiveBrBunkerDoorOpenEe'),

    objectiveBrX2Ambush: smallint('objectiveBrX2Ambush'),
    objectiveBrX2ArmoredCar: smallint('objectiveBrX2ArmoredCar'),
    objectiveBrX2DriverAssist: smallint('objectiveBrX2DriverAssist'),
    objectiveBrX2TrainDamage: smallint('objectiveBrX2TrainDamage'),
    objectiveBrX2TrainDestroyed: smallint('objectiveBrX2TrainDestroyed'),
    objectiveBrX2TurretDisabled: smallint('objectiveBrX2TurretDisabled'),
    objectiveBrX2TurretDamage: smallint('objectiveBrX2TurretDamage'),
})

export const matches_cw_mp = () => ({
    ...matches_basic(),

    accuracy: doublePrecision(C.ACCURACY),
    ekia: smallint('ekia'),
    ekiadRatio: doublePrecision('ekiadRatio'),
    rankAtEnd: smallint('rankAtEnd'),
    shots: smallint('shots'),
    shotsLanded: smallint('shotsLanded'),
    shotsMissed: smallint('shotsMissed'),
    shotsFired: smallint('shotsFired'),
    team1Score: smallint('team1Score'),
    team2Score: smallint('team2Score'),
    timePlayedAlive: integer('timePlayedAlive'),
    multikills: smallint('multikills'),
    highestMultikill: smallint('highestMultikill'),
    hits: smallint('hits'),
    suicides: smallint('suicides'),
    objectives: smallint('objectives'),
})

export const matches_vg_mp = () => ({
    ...matches_basic(),

    winningTeam: varchar('winningTeam', { length: NAME_LIMIT_2 }),
    team1Score: smallint('team1Score'),
    team2Score: smallint('team2Score'),
    operator: varchar('operator', { length: NAME_LIMIT_2 }),
    operatorSkinId: integer('operatorSkinId'),
    operatorExecution: varchar('operatorExecution', { length: NAME_LIMIT_2 }),
    damageTaken: bigint('damageTaken', { mode: 'number' }),

    accuracy: doublePrecision(C.ACCURACY),
    rankAtEnd: smallint('rankAtEnd'),
    averageSpeedDuringMatch: doublePrecision('averageSpeedDuringMatch'),
    shotsLanded: smallint('shotsLanded'),
    utcConnectTimeS: integer('utcConnectTimeS'),
    utcDisconnectTimeS: integer('utcDisconnectTimeS'),
    distanceTraveled: integer('distanceTraveled'),
    shotsMissed: smallint('shotsMissed'),
    prestigeAtEnd: smallint('prestigeAtEnd'),
    hits: smallint('hits'),
    executions: smallint('executions'),
    suicides: smallint('suicides'),
    percentTimeMoving: doublePrecision('percentTimeMoving'),
    shots: smallint('shots'),
    shotsFired: smallint('shotsFired'),
})

export const fullmatches_mw_basic = () => ({
    duration: integer(C.DURATION).default(0).notNull(),
    timePlayed: integer(C.TIME_PLAYED).default(0).notNull(),
    kills: smallint(C.KILLS).default(0).notNull(),
    deaths: smallint(C.DEATHS).default(0).notNull(),
    kdRatio: doublePrecision(C.KDRATIO).default(0).notNull(),
    damageDone: bigint('damageDone', { mode: 'number' }).default(0).notNull(),
    headshots: smallint(C.HEADSHOTS).default(0).notNull(),
    longestStreak: smallint('longestStreak').default(0).notNull(),
    assists: smallint('assists').default(0).notNull(),
    score: integer('score').default(0).notNull(),
    scorePerMinute: doublePrecision('scorePerMinute').default(0).notNull(),
    totalXp: integer('totalXp').default(0).notNull(),
})

export const fullmatches_mw_mp_basic = () => ({
    ...fullmatches_basic(),

    accuracy: doublePrecision(C.ACCURACY),
    shotsLanded: smallint('shotsLanded'),
    shotsMissed: smallint('shotsMissed'),
    shotsFired: smallint('shotsFired'),
    team1Score: smallint('team1Score'),
    team2Score: smallint('team2Score'),
})

export const fullmatches_mw_mp = () => ({
    ...matches_mw_mp(),
    ...fullmatches_mw_basic(),
})

export const fullmatches_mw_wz_basic = () => ({
    ...fullmatches_basic(),

    teamCount: smallint('teamCount'),
    teamSurvivalTime: integer('teamSurvivalTime'),
    playerCount: smallint('playerCount'),
    gulagDeaths: smallint('gulagDeaths'),
    gulagKills: smallint('gulagKills'),
})

export const fullmatches_mw_wz = () => ({
    ...matches_mw_wz(),
    ...fullmatches_mw_basic(),
})
