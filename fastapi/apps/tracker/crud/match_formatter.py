import copy
from collections import defaultdict
from typing import Literal
from sqlalchemy.orm import Session

from core.database import get_db

from apps.base.schemas.main import C
from apps.base.crud.utils import date_format, in_logs, get_last_id

from apps.tracker.crud.store_tables import STT
from apps.tracker.crud.store_game_modes import SGM
from apps.tracker.crud.utils import is_none_value
from apps.tracker.schemas.main import (
    SC,
    MatchLoadout,
    MatchLoadoutDataStats,
    MatchLoadoutDataWeaponStats,
    LabelData,
    GameModeOnly,
    LabelType,
    MatchResultMp,
)


class TrackerLabels:
    def __init__(self):
        self.decoded: dict[str, dict[str, LabelData]] = {
            label_type: {} for label_type in STT.label_tables
        }
        self.encoded: dict[str, dict[str, str]] = {
            label_type: {} for label_type in STT.label_tables
        }

        with next(get_db()) as db:
            for name, table in STT.label_tables.items():
                all_label_data = db.query(table).all()
                for label_data in all_label_data:
                    index = str(label_data.id)
                    self.decoded[name][index] = {
                        C.NAME: label_data.name,
                        C.LABEL: label_data.label,
                    }
                    self.encoded[name][label_data.name] = index

    def create_index(
        self,
        db: Session,
        label_data: LabelData,
        label_type: LabelType,
        game_mode: GameModeOnly,
    ):
        table = STT.label_tables[label_type]
        existing = db.query(table).filter(table.name == label_data[C.NAME]).first()

        if existing:
            label_data = existing
        else:
            label_data = table(
                id=get_last_id(db, table) + 1,
                name=label_data[C.NAME],
                label=label_data[C.LABEL][:99] if label_data[C.LABEL] else None,
                game_mode=game_mode,
            )
            db.add(label_data)
            db.commit()
            db.refresh(label_data)

        index = str(label_data.id)

        self.decoded[label_type][index] = {
            C.NAME: label_data.name,
            C.LABEL: label_data.label,
        }
        self.encoded[label_type][label_data.name] = index

        return index

    def get_index(
        self,
        name: str | None,
        label: str | None,
        label_type: LabelType,
        game_mode: GameModeOnly,
    ) -> str | None:

        if name == 'specialty_null' or is_none_value(name):
            return

        index: str | None = self.encoded[label_type].get(name)

        if index is None:
            with next(get_db()) as db:
                index = self.create_index(
                    db, {C.NAME: name, C.LABEL: label}, label_type, game_mode
                )

        return index

    def get_label_data_from_table(
        self, db: Session, index: str, label_type: LabelType
    ) -> LabelData:

        table = STT.label_tables[label_type]
        label_data = db.query(table).filter(table.id == index).first()

        if label_data:
            label_data = {C.NAME: label_data.name, C.LABEL: label_data.label}
        else:
            in_logs(
                self.get_label_data.__name__,
                f'[{index}] [{label_type}] {C.NOT_FOUND}',
                'cod_logs_error',
            )
            label_data = {C.NAME: 'unknown', C.LABEL: None}

        self.decoded[label_type][index] = label_data
        self.encoded[label_type][label_data[C.NAME]] = index

        return label_data

    def get_label_data(self, index: str | None, label_type: LabelType) -> LabelData:
        if not index:
            return {C.NAME: 'unknown', C.LABEL: None}

        label_data: LabelData | None = self.decoded[label_type].get(index)

        if label_data is None:
            with next(get_db()) as db:
                label_data = self.get_label_data_from_table(db, index, label_type)

        return copy.deepcopy(label_data)

    def get_mode(
        self,
        name: str | None,
        label_type: Literal['map', 'mode'],
        game_mode: GameModeOnly,
    ) -> LabelData:
        index = self.get_index(name, None, label_type, game_mode)
        label_data = self.get_label_data(index, label_type)

        return label_data


class MatchFormatter(TrackerLabels):
    def __init__(self):
        super().__init__()

        self.GAME_COLUMNS: dict[GameModeOnly, list[str]] = {}
        tables = STT.get_tables(C.ALL, C.ALL, C.MATCHES)
        for t in tables:
            self.GAME_COLUMNS[t.game_mode] = [
                column
                for column in t.table.__dict__
                if '__' not in column and '_sa_class_manager' not in column
            ]

        self.WEAPON_TYPES = tuple(MatchLoadout.model_fields)
        self.STAT_TYPES = tuple(MatchLoadoutDataWeaponStats.model_fields)

        self.SPLIT_ON_LOADOUTS = '\n'
        self.SPLIT_ON_WEAPONS = ','
        self.SPLIT_ON_INDEXES = ' '

    def format_match(self, match_raw: dict, game_mode: GameModeOnly):
        match = {}
        match[C.TIME] = date_format(match_raw['utcStartSeconds'])

        for name, value in match_raw[C.PLAYER].items():
            if name in SC.PLAYER and not is_none_value(value):
                match[name] = value

        for name, value in match_raw.items():

            if name not in SC.META:
                continue

            if name == C.RESULT:
                if value == 'win':
                    value = MatchResultMp.WIN
                elif value == 'loss':
                    value = MatchResultMp.LOSS
                else:
                    value = MatchResultMp.DRAW

            match[name] = value

        for name, value in match_raw['playerStats'].items():
            name = SC.RENAME_TO_BASIC.get(name, name)
            if name in self.GAME_COLUMNS[game_mode]:
                match[name] = value
            else:
                SC.new_columns.add(name)

        is_mw = SGM.is_game_mode_mw(game_mode)

        if is_mw is False and C.WEAPON_STATS in match:
            del match[C.WEAPON_STATS]
        if is_mw is False and C.LOADOUT in match:
            del match[C.LOADOUT]

        for name, value in match.items():
            if name in SC.ROUND:
                value = round(value, 2)
            elif name in (C.DURATION, 'teamSurvivalTime'):
                value /= 1000
            elif name == C.ACCURACY:
                value = round(value * 100, 2)
            elif name == C.LOADOUT:
                value = self.encode_loadouts(value, game_mode)
            elif name == C.WEAPON_STATS:
                value = self.encode_weapon_stats(value, game_mode)
            else:
                continue

            match[name] = value

        return match

    def encode_loadout(self, loadout: dict[str, dict | list], game_mode: GameModeOnly):
        encoded_loadout = []

        for weapon_type in self.WEAPON_TYPES:
            encoded = []

            if weapon_type in ('primaryWeapon', 'secondaryWeapon'):
                weapon: dict = loadout[weapon_type]

                if weapon_index := self.get_index(
                    weapon[C.NAME], weapon[C.LABEL], 'weapons', game_mode
                ):
                    # first element is weapon index
                    encoded.append(weapon_index)
                    for attachment in weapon['attachments']:
                        if attachment_index := self.get_index(
                            attachment[C.NAME],
                            attachment[C.LABEL],
                            'attachments',
                            game_mode,
                        ):
                            # rest elements is attachments
                            encoded.append(attachment_index)

            elif weapon_type == 'perks':
                all_perks: list = loadout[weapon_type] + loadout['extraPerks']

                for perk in all_perks:
                    perk_name = perk[C.NAME].replace('specialty_', '')

                    if perk_index := self.get_index(
                        perk_name, perk[C.LABEL], weapon_type, game_mode
                    ):
                        encoded.append(perk_index)

            elif weapon_type == 'killstreaks':
                killstreaks: list = loadout[weapon_type]

                for killstreak in killstreaks:
                    if killstreak_index := self.get_index(
                        killstreak[C.NAME], killstreak[C.LABEL], weapon_type, game_mode
                    ):
                        encoded.append(killstreak_index)

            elif weapon_type in ('tactical', 'lethal'):
                equip: dict = loadout[weapon_type]
                equip_name = equip[C.NAME].replace('equip_', '')

                if equip_index := self.get_index(
                    equip_name, equip[C.LABEL], weapon_type, game_mode
                ):
                    encoded.append(equip_index)

            encoded_loadout.append(self.SPLIT_ON_INDEXES.join(encoded))

        return self.SPLIT_ON_WEAPONS.join(encoded_loadout)

    def encode_loadouts(self, loadouts: list[dict], game_mode: GameModeOnly):
        encoded_loadouts = [
            self.encode_loadout(loadout, game_mode) for loadout in loadouts
        ]
        return self.SPLIT_ON_LOADOUTS.join([i for i in encoded_loadouts if i])

    def encode_weapon_stats(
        self,
        weapon_stats: dict[str, MatchLoadoutDataWeaponStats],
        game_mode: GameModeOnly,
    ):
        encoded_stats = []

        for weapon_name, stats in weapon_stats.items():
            weapon_index = self.get_index(weapon_name, None, 'weapons', game_mode)
            if not weapon_index:
                continue
            stat_values = [str(int(stats[stat_type])) for stat_type in self.STAT_TYPES]
            encoded_stat = self.SPLIT_ON_INDEXES.join([weapon_index] + stat_values)
            encoded_stats.append(encoded_stat)

        return self.SPLIT_ON_LOADOUTS.join(encoded_stats) or None

    def decode_loadout(self, loadouts_raw: str | None):
        decoded_loadouts: list[MatchLoadout] = []

        if not loadouts_raw:
            return decoded_loadouts

        loadouts = loadouts_raw.split(self.SPLIT_ON_LOADOUTS)

        for loadout in loadouts:
            decoded_loadout: MatchLoadout = {}
            weapons = loadout.split(self.SPLIT_ON_WEAPONS)

            for index, weapon_type in enumerate(self.WEAPON_TYPES):
                weapon_indexes = weapons[index].split(self.SPLIT_ON_INDEXES)

                if weapon_type in ('primaryWeapon', 'secondaryWeapon'):
                    # removed first element is a weapon index and the rest is attachments indexes
                    weapon_index = weapon_indexes.pop(0)
                    weapon = self.get_label_data(weapon_index, 'weapons')
                    weapon['attachments'] = [
                        self.get_label_data(attachment_index, 'attachments')
                        for attachment_index in weapon_indexes
                    ]
                    decoded_loadout[weapon_type] = weapon

                elif weapon_type in ('perks', 'killstreaks'):
                    decoded_loadout[weapon_type] = [
                        self.get_label_data(index, weapon_type)
                        for index in weapon_indexes
                        if index
                    ]

                elif weapon_type in ('tactical', 'lethal'):
                    if equip_index := weapon_indexes[0]:
                        decoded_loadout[weapon_type] = self.get_label_data(
                            equip_index, weapon_type
                        )
                    else:
                        decoded_loadout[weapon_type] = None

            decoded_loadouts.append(decoded_loadout)

        return decoded_loadouts

    def decode_weapon_stats(self, weapon_stats: str | None):
        decoded_weapon_stats: list[MatchLoadoutDataStats] = []

        if not weapon_stats:
            return decoded_weapon_stats

        weapon_stats = weapon_stats.split(self.SPLIT_ON_LOADOUTS)

        for encoded_weapon_stat in weapon_stats:
            encoded_weapon_stat = encoded_weapon_stat.split(self.SPLIT_ON_INDEXES)

            # removed first element is a weapon index and the rest is weapon stat values
            weapon_index = encoded_weapon_stat.pop(0)
            decoded_weapon_stat = self.get_label_data(weapon_index, 'weapons')
            decoded_weapon_stat[C.STATS] = {}
            for stat_index, stat_type in enumerate(self.STAT_TYPES):
                decoded_weapon_stat[C.STATS][stat_type] = int(encoded_weapon_stat[stat_index])

            decoded_weapon_stats.append(decoded_weapon_stat)

        return decoded_weapon_stats

    def format_loadout(self, player_loadouts: list[str]):
        '''Count (Primary + Secondary) weapon loadout'''
        loadout: defaultdict[str, int] = defaultdict(int)

        for loadouts in player_loadouts:
            decoded_loadouts = self.decode_loadout(loadouts)

            for decoded_loadout in decoded_loadouts:
                weapon_names = []
                for weapon_name in ('primaryWeapon', 'secondaryWeapon'):
                    weapon_names.append(
                        decoded_loadout[weapon_name][C.LABEL]
                        or decoded_loadout[weapon_name][C.NAME]
                    )
                weapon_names = ' + '.join(weapon_names)
                loadout[weapon_names] += 1

        return loadout


MF = MatchFormatter()
