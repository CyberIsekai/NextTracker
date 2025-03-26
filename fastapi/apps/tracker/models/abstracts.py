from sqlalchemy import (
    Column,
    TIMESTAMP,
    Float,
    SmallInteger,
    Integer,
    BigInteger,
    String,
)
from sqlalchemy.sql import func

from core.config import settings
from apps.base.models.main import Base


class cod_label(Base):
    __abstract__ = True

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(settings.NAME_LIMIT_2), nullable=False, unique=True)
    label = Column(String(settings.NAME_LIMIT_2))
    game_mode = Column(String(settings.NAME_LIMIT))
    time = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp())


class basic(Base):
    __abstract__ = True

    id = Column(Integer, primary_key=True, index=True)
    time = Column(TIMESTAMP, nullable=False, index=True)
    matchID = Column(String(settings.NAME_LIMIT_2), nullable=False, index=True)
    uno = Column(String(settings.NAME_LIMIT_2), nullable=False, index=True)
    map = Column(String(settings.NAME_LIMIT_2))
    mode = Column(String(settings.NAME_LIMIT_2))
    team = Column(String(60))
    result = Column(SmallInteger, nullable=False, server_default='0')


class matches_basic(basic):
    __abstract__ = True

    duration = Column(Integer, index=True, nullable=False, server_default='0')
    timePlayed = Column(Integer, index=True, nullable=False, server_default='0')
    kills = Column(SmallInteger, index=True, nullable=False, server_default='0')
    deaths = Column(SmallInteger, index=True, nullable=False, server_default='0')
    kdRatio = Column(Float(53), index=True, nullable=False, server_default='0')
    damageDone = Column(BigInteger, index=True, nullable=False, server_default='0')
    headshots = Column(SmallInteger, index=True, nullable=False, server_default='0')
    longestStreak = Column(SmallInteger, index=True, nullable=False, server_default='0')
    assists = Column(SmallInteger, index=True, nullable=False, server_default='0')
    score = Column(Integer, index=True, nullable=False, server_default='0')
    scorePerMinute = Column(Float(53), index=True, nullable=False, server_default='0')
    totalXp = Column(Integer, index=True, nullable=False, server_default='0')


class fullmatches_basic(basic):
    __abstract__ = True

    username = Column(String(settings.NAME_LIMIT_2), index=True)
    clantag = Column(String(60), index=True)

    duration = Column(Integer, nullable=False, server_default='0')
    timePlayed = Column(Integer, nullable=False, server_default='0')
    kills = Column(SmallInteger, nullable=False, server_default='0')
    deaths = Column(SmallInteger, nullable=False, server_default='0')
    kdRatio = Column(Float(53), nullable=False, server_default='0')
    damageDone = Column(BigInteger, nullable=False, server_default='0')
    headshots = Column(SmallInteger, nullable=False, server_default='0')
    longestStreak = Column(SmallInteger, nullable=False, server_default='0')
    assists = Column(SmallInteger, nullable=False, server_default='0')
    score = Column(Integer, nullable=False, server_default='0')
    scorePerMinute = Column(Float(53), nullable=False, server_default='0')
    totalXp = Column(Integer, nullable=False, server_default='0')


class basic_mw(matches_basic):
    __abstract__ = True

    username = Column(String(settings.NAME_LIMIT_2), index=True)
    clantag = Column(String(60), index=True)

    medalXp = Column(Integer)
    matchXp = Column(Integer)
    scoreXp = Column(Integer)
    wallBangs = Column(SmallInteger)
    rank = Column(SmallInteger)
    distanceTraveled = Column(Integer)
    executions = Column(SmallInteger)
    nearmisses = Column(SmallInteger)
    percentTimeMoving = Column(Float(53))
    miscXp = Column(Integer)

    damageTaken = Column(BigInteger)
    loadout = Column(String)

    objectiveMedalScoreKillSsAssaultDrone = Column(SmallInteger)
    objectiveMedalScoreKillSsManualTurret = Column(SmallInteger)
    objectiveMedalScoreKillSsRadarDrone = Column(SmallInteger)
    objectiveMedalScoreKillSsHoverJet = Column(SmallInteger)
    objectiveMedalScoreKillSsSentryGun = Column(SmallInteger)
    objectiveMedalScoreKillSsScramblerDrone = Column(SmallInteger)
    objectiveMedalScoreSsKillAssaultDrone = Column(SmallInteger)
    objectiveMedalScoreSsKillSentryGun = Column(SmallInteger)
    objectiveMedalScoreSsKillPrecisionAirstrike = Column(SmallInteger)
    objectiveMedalScoreSsKillTomaStrike = Column(SmallInteger)
    objectiveMedalScoreSsKillJuggernaut = Column(SmallInteger)
    objectiveMedalScoreSsKillManualTurret = Column(SmallInteger)
    objectiveDestroyedVehicleHeavy = Column(SmallInteger)
    objectiveDestroyedVehicleLight = Column(SmallInteger)
    objectiveDestroyedVehicleMedium = Column(SmallInteger)
    objectiveDestroyedTacInsert = Column(SmallInteger)
    objectiveDestroyedEquipment = Column(SmallInteger)
    objectiveMedalModeXAssaultScore = Column(SmallInteger)
    objectiveMedalModeDomSecureAssistScore = Column(SmallInteger)
    objectiveManualFlareMissileRedirect = Column(SmallInteger)
    objectiveAssistDecoy = Column(SmallInteger)
    objectiveEmpedPlayer = Column(SmallInteger)
    objectiveEmpedVehicle = Column(SmallInteger)
    objectivePerkMarkedTarget = Column(SmallInteger)
    objectiveReviver = Column(SmallInteger)
    objectiveRadarDroneReconAssist = Column(SmallInteger)
    objectiveRadarDroneReconEnemyMarked = Column(SmallInteger)
    objectiveShieldDamage = Column(SmallInteger)
    objectiveShieldAssist = Column(SmallInteger)
    objectiveTrophyDefense = Column(SmallInteger)
    objectiveHack = Column(SmallInteger)
    objectiveTagCollected = Column(SmallInteger)
    objectiveTagDenied = Column(SmallInteger)
    objectiveMunitionsBoxTeammateUsed = Column(SmallInteger)
    objectiveWeaponDropTeammateUsed = Column(SmallInteger)
    objectiveScrapAssist = Column(SmallInteger)


class matches_mw_mp(basic_mw):
    __abstract__ = True

    accuracy = Column(Float(53))
    averageSpeedDuringMatch = Column(Float(53))
    shotsLanded = Column(SmallInteger)
    shotsMissed = Column(SmallInteger)
    suicides = Column(SmallInteger)
    seasonRank = Column(SmallInteger)
    shotsFired = Column(SmallInteger)
    team1Score = Column(SmallInteger)
    team2Score = Column(SmallInteger)
    weaponStats = Column(String)

    objectiveBrDoomstationActivation = Column(SmallInteger)
    objectiveBrDoomstationSuccess = Column(SmallInteger)
    objectiveBrVillainContribution = Column(SmallInteger)
    objectiveBrHeroContribution = Column(SmallInteger)
    objectiveMedalScoreKillApcRus = Column(SmallInteger)
    objectiveMedalScoreKillSsUav = Column(SmallInteger)
    objectiveMedalScoreKillSsGunship = Column(SmallInteger)
    objectiveMedalScoreKillSsBradley = Column(SmallInteger)
    objectiveMedalScoreKillSsChopperGunner = Column(SmallInteger)
    objectiveMedalScoreKillSsFuelAirstrike = Column(SmallInteger)
    objectiveMedalScoreKillSsPacSentry = Column(SmallInteger)
    objectiveMedalScoreSsKillBradley = Column(SmallInteger)
    objectiveMedalScoreSsKillChopperSupport = Column(SmallInteger)
    objectiveMedalScoreSsKillChopperGunner = Column(SmallInteger)
    objectiveMedalScoreSsKillWhitePhosphorus = Column(SmallInteger)
    objectiveMedalScoreSsKillGunship = Column(SmallInteger)
    objectiveMedalScoreSsKillPacSentry = Column(SmallInteger)
    objectiveMedalScoreSsKillCruisePredator = Column(SmallInteger)
    objectiveMedalScoreSsKillHoverJet = Column(SmallInteger)
    objectiveMedalModeArmSecureMidScore = Column(SmallInteger)
    objectiveMedalModeArmSecureOuterMidScore = Column(SmallInteger)
    objectiveMedalModeArmSecureOuterScore = Column(SmallInteger)
    objectiveMedalModeDomSecureNeutralScore = Column(SmallInteger)
    objectiveMedalModeDomSecureScore = Column(SmallInteger)
    objectiveMedalModeDomSecureBScore = Column(SmallInteger)
    objectiveMedalModeDomSecureNeutralilizedScore = Column(SmallInteger)
    objectiveMedalModeSdPlantSaveScore = Column(SmallInteger)
    objectiveMedalModeSdDefuseScore = Column(SmallInteger)
    objectiveMedalModeSdDefuseSaveScore = Column(SmallInteger)
    objectiveMedalModeSdDetonateScore = Column(SmallInteger)
    objectiveMedalModeSdLastDefuseScore = Column(SmallInteger)
    objectiveMedalModeSiegeSecureScore = Column(SmallInteger)
    objectiveMedalModeCyberKillCarrierScore = Column(SmallInteger)
    objectiveMedalModeHpSecureScore = Column(SmallInteger)
    objectiveMedalModeHpSecureReducedScore = Column(SmallInteger)
    objectiveMedalModeCtfCapScore = Column(SmallInteger)
    objectiveMedalModeCtfKillCarrierScore = Column(SmallInteger)
    objectiveMedalModeXDefendScore = Column(SmallInteger)
    objectiveMedalModeKcOwnTagsScore = Column(SmallInteger)
    objectiveKillBonus = Column(SmallInteger)
    objectiveKillDenied = Column(SmallInteger)
    objectiveKillConfirmed = Column(SmallInteger)
    objectiveKillstreakFullScore = Column(SmallInteger)
    objectiveKillJuggernaut = Column(SmallInteger)
    objectiveKillAsJuggernaut = Column(SmallInteger)
    objectiveGrndInObj = Column(SmallInteger)
    objectiveRugbyObjPush = Column(SmallInteger)
    objectivePlant = Column(SmallInteger)
    objectiveLastManKill = Column(SmallInteger)
    objectiveDirectionalUavAssist = Column(SmallInteger)
    objectiveDisabledVehicleLight = Column(SmallInteger)
    objectiveDisabledVehicleMedium = Column(SmallInteger)
    objectiveDisabledVehicleHeavy = Column(SmallInteger)
    objectiveDroppedGunRank = Column(SmallInteger)
    objectiveDzCapture = Column(SmallInteger)
    objectiveWhitePhosphorusAssist = Column(SmallInteger)
    objectiveTdefHoldObj = Column(SmallInteger)
    objectiveCarrierBonus = Column(SmallInteger)
    objectiveFlagGrab = Column(SmallInteger)
    objectiveFlagReturn = Column(SmallInteger)
    objectiveFirstInfected = Column(SmallInteger)
    objectiveHijacker = Column(SmallInteger)
    objectiveCaptureKill = Column(SmallInteger)
    objectiveUavAssist = Column(SmallInteger)
    objectiveKcFriendlyPickup = Column(SmallInteger)
    objectiveObjProgDefend = Column(SmallInteger)
    objectiveMegaBank = Column(SmallInteger)
    objectiveGrindFriendlyPickup = Column(SmallInteger)
    objectiveTagScore = Column(SmallInteger)
    objectiveKothInObj = Column(SmallInteger)
    objectiveEmpGrab = Column(SmallInteger)
    objectiveExecution = Column(SmallInteger)
    objectiveGainedGunRank = Column(SmallInteger)
    objectiveSquadSpawnSelf = Column(SmallInteger)
    objectiveSquadSpawn = Column(SmallInteger)
    objectiveScramblerDroneGuardAssist = Column(SmallInteger)
    objectiveSnowballKill = Column(SmallInteger)
    objectiveSurvivor = Column(SmallInteger)
    objectiveFinalSurvivor = Column(SmallInteger)
    objectiveInfectedSurvivor = Column(SmallInteger)


class matches_mw_wz(basic_mw):
    __abstract__ = True

    teamCount = Column(SmallInteger)
    teamSurvivalTime = Column(Integer)
    bonusXp = Column(Integer)
    challengeXp = Column(Integer)
    gulagDeaths = Column(SmallInteger)
    gulagKills = Column(SmallInteger)
    playerCount = Column(SmallInteger)

    objectiveBinocularsAssist = Column(SmallInteger)
    objectiveBinocularsMarked = Column(SmallInteger)
    objectiveEnemyWiped = Column(SmallInteger)
    objectiveTeamWiped = Column(SmallInteger)
    objectiveLastStandKill = Column(SmallInteger)
    objectivePlunderCashBloodMoney = Column(SmallInteger)

    objectiveBrArmoryTraderUse = Column(SmallInteger)
    objectiveBrCommTowerActivated = Column(SmallInteger)
    objectiveBrC130BoxOpen = Column(SmallInteger)
    objectiveBrCacheOpen = Column(SmallInteger)
    objectiveBrDownEnemyCircle1 = Column(SmallInteger)
    objectiveBrDownEnemyCircle2 = Column(SmallInteger)
    objectiveBrDownEnemyCircle3 = Column(SmallInteger)
    objectiveBrDownEnemyCircle4 = Column(SmallInteger)
    objectiveBrDownEnemyCircle5 = Column(SmallInteger)
    objectiveBrDownEnemyCircle6 = Column(SmallInteger)
    objectiveBrLootChopperBoxOpen = Column(SmallInteger)
    objectiveBrGametypeBodycountFinalKill = Column(SmallInteger)
    objectiveBrMissionPickupTablet = Column(SmallInteger)
    objectiveBrKioskBuy = Column(SmallInteger)
    objectiveBrRogueCacheOpen = Column(SmallInteger)
    objectiveBrSupplySweepAssist = Column(SmallInteger)

    objectiveBrPerseusLockerDoorOpenEe = Column(SmallInteger)
    objectiveBrForgottenLockerDoorOpenEe = Column(SmallInteger)
    objectiveBrVikhorLockerDoorOpenEe = Column(SmallInteger)
    objectiveBrBunkerDoorOpenEe = Column(SmallInteger)

    objectiveBrX2Ambush = Column(SmallInteger)
    objectiveBrX2ArmoredCar = Column(SmallInteger)
    objectiveBrX2DriverAssist = Column(SmallInteger)
    objectiveBrX2TrainDamage = Column(SmallInteger)
    objectiveBrX2TrainDestroyed = Column(SmallInteger)
    objectiveBrX2TurretDisabled = Column(SmallInteger)
    objectiveBrX2TurretDamage = Column(SmallInteger)


class matches_cw_mp(matches_basic):
    __abstract__ = True

    accuracy = Column(Float(53))
    ekia = Column(SmallInteger)
    ekiadRatio = Column(Float(53))
    rankAtEnd = Column(SmallInteger)
    shots = Column(SmallInteger)
    shotsLanded = Column(SmallInteger)
    shotsMissed = Column(SmallInteger)
    shotsFired = Column(SmallInteger)
    team1Score = Column(SmallInteger)
    team2Score = Column(SmallInteger)
    timePlayedAlive = Column(Integer)
    multikills = Column(SmallInteger)
    highestMultikill = Column(SmallInteger)
    hits = Column(SmallInteger)
    suicides = Column(SmallInteger)
    objectives = Column(SmallInteger)


class matches_vg_mp(matches_basic):
    __abstract__ = True
    winningTeam = Column(String(settings.NAME_LIMIT_2))
    team1Score = Column(SmallInteger)
    team2Score = Column(SmallInteger)
    operator = Column(String(settings.NAME_LIMIT_2))
    operatorSkinId = Column(Integer)
    operatorExecution = Column(String(settings.NAME_LIMIT_2))
    damageTaken = Column(BigInteger)

    rankAtEnd = Column(SmallInteger)
    averageSpeedDuringMatch = Column(Float(53))
    accuracy = Column(Float(53))
    shotsLanded = Column(SmallInteger)
    utcConnectTimeS = Column(Integer)
    utcDisconnectTimeS = Column(Integer)
    distanceTraveled = Column(Integer)
    shotsMissed = Column(SmallInteger)
    prestigeAtEnd = Column(SmallInteger)
    hits = Column(SmallInteger)
    executions = Column(SmallInteger)
    suicides = Column(SmallInteger)
    percentTimeMoving = Column(Float(53))
    shots = Column(SmallInteger)
    shotsFired = Column(SmallInteger)


class fullmatches_mw_mp_basic(fullmatches_basic):
    __abstract__ = True

    accuracy = Column(Float(53))
    shotsLanded = Column(SmallInteger)
    shotsMissed = Column(SmallInteger)
    shotsFired = Column(SmallInteger)
    team1Score = Column(SmallInteger)
    team2Score = Column(SmallInteger)


class fullmatches_mw_mp(matches_mw_mp):
    __abstract__ = True

    duration = Column(Integer, nullable=False, server_default='0')
    timePlayed = Column(Integer, nullable=False, server_default='0')
    kills = Column(SmallInteger, nullable=False, server_default='0')
    deaths = Column(SmallInteger, nullable=False, server_default='0')
    kdRatio = Column(Float(53), nullable=False, server_default='0')
    damageDone = Column(BigInteger, nullable=False, server_default='0')
    headshots = Column(SmallInteger, nullable=False, server_default='0')
    longestStreak = Column(SmallInteger, nullable=False, server_default='0')
    assists = Column(SmallInteger, nullable=False, server_default='0')
    score = Column(Integer, nullable=False, server_default='0')
    scorePerMinute = Column(Float(53), nullable=False, server_default='0')
    totalXp = Column(Integer, nullable=False, server_default='0')


class fullmatches_mw_wz_basic(fullmatches_basic):
    __abstract__ = True

    teamCount = Column(SmallInteger)
    teamSurvivalTime = Column(Integer)
    playerCount = Column(SmallInteger)
    gulagDeaths = Column(SmallInteger)
    gulagKills = Column(SmallInteger)


class fullmatches_mw_wz(matches_mw_wz):
    __abstract__ = True

    duration = Column(Integer, nullable=False, server_default='0')
    timePlayed = Column(Integer, nullable=False, server_default='0')
    kills = Column(SmallInteger, nullable=False, server_default='0')
    deaths = Column(SmallInteger, nullable=False, server_default='0')
    kdRatio = Column(Float(53), nullable=False, server_default='0')
    damageDone = Column(BigInteger, nullable=False, server_default='0')
    headshots = Column(SmallInteger, nullable=False, server_default='0')
    longestStreak = Column(SmallInteger, nullable=False, server_default='0')
    assists = Column(SmallInteger, nullable=False, server_default='0')
    score = Column(Integer, nullable=False, server_default='0')
    scorePerMinute = Column(Float(53), nullable=False, server_default='0')
    totalXp = Column(Integer, nullable=False, server_default='0')
