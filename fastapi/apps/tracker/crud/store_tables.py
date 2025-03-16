from typing import Literal

from apps.base.schemas.main import C

from apps.tracker.schemas.main import (
    TableGameData,
    GameMode,
    Game,
    LabelType,
    Mode,
    MatchesSource,
    YearWzTable,
)
from apps.tracker.models.main import (
    cod_players,
    cod_matches_mw_wz,
    cod_matches_mw_mp,
    cod_matches_cw_mp,
    cod_matches_vg_mp,
    cod_fullmatches_mw_mp,
    cod_fullmatches_mw_wz_2020,
    cod_fullmatches_mw_wz_2021,
    cod_fullmatches_mw_wz_2022,
    cod_fullmatches_mw_wz_2023,
    cod_fullmatches_basic_mw_mp,
    cod_fullmatches_basic_mw_wz_2020,
    cod_fullmatches_basic_mw_wz_2021,
    cod_fullmatches_basic_mw_wz_2022,
    cod_fullmatches_basic_mw_wz_2023,
    cod_logs,
    cod_logs_player,
    cod_logs_error,
    cod_logs_search,
    cod_logs_task_queues,
    cod_label_map,
    cod_label_mode,
    cod_label_weapons,
    cod_label_attachments,
    cod_label_perks,
    cod_label_killstreaks,
    cod_label_tactical,
    cod_label_lethal,
    cod_label_games_stats,
)


def create_table_data(game_mode: GameMode, table: object, source: MatchesSource):
    return TableGameData(
        game_mode=game_mode, table=table, name=table.__tablename__, source=source
    )


class TrackerPlayers:
    def __init__(self):
        self.players = cod_players
        self.players_basic = tuple(
            map(
                lambda c: self.players.__dict__[c],
                (
                    C.ID,
                    C.UNO,
                    C.ACTI,
                    C.BATTLE,
                    C.USERNAME,
                    C.CLANTAG,
                    C.GROUP,
                    C.GAMES,
                    C.TIME,
                ),
            )
        )


class TrackerMatches(TrackerPlayers):
    '''Tables with players matches'''

    def __init__(self):
        super().__init__()
        self.matches = {
            C.MW_WZ: cod_matches_mw_wz,
            C.MW_MP: cod_matches_mw_mp,
            C.CW_MP: cod_matches_cw_mp,
            C.VG_MP: cod_matches_vg_mp,
        }

    def matches_table(self, game_mode: GameMode, source: MatchesSource):
        table = self.__dict__[source][game_mode]
        return create_table_data(game_mode, table, source)

    def matches_tables(self, game: Game, mode: Mode, source: MatchesSource):
        path = self.__dict__[source]

        if game == mode == C.ALL:
            game_modes = path

        elif (game_mode := f'{game}_{mode}') in path:
            game_modes = {game_mode: path[game_mode]}

        elif game == C.MW and mode == C.ALL:
            game_modes = {C.MW_MP: path[C.MW_MP], C.MW_WZ: path[C.MW_WZ]}

        elif game == C.CW and mode == C.ALL:
            game_modes = {C.CW_MP: path[C.CW_MP]}

        elif game == C.VG and mode == C.ALL:
            game_modes = {C.VG_MP: path[C.VG_MP]}

        else:
            game_modes = {}

        tables = [
            create_table_data(game_mode, table, source)
            for game_mode, table in game_modes.items()
        ]

        return tables


class TrackerFullmatches(TrackerMatches):
    '''
    Data from players matches parsed by matchID\n
    Splitted by years for divide usage disk space\n
    MAIN with All columns\n
    BASIC with Basic columns, for minimal space usage
    '''

    def __init__(self):
        super().__init__()
        self.FULLMATCHES = {
            C.MW_MP: {
                C.MAIN: cod_fullmatches_mw_mp,
                C.BASIC: cod_fullmatches_basic_mw_mp,
            },
            C.MW_WZ: {
                C.MAIN: {
                    '2020': cod_fullmatches_mw_wz_2020,
                    '2021': cod_fullmatches_mw_wz_2021,
                    '2022': cod_fullmatches_mw_wz_2022,
                    '2023': cod_fullmatches_mw_wz_2023,
                },
                C.BASIC: {
                    '2020': cod_fullmatches_basic_mw_wz_2020,
                    '2021': cod_fullmatches_basic_mw_wz_2021,
                    '2022': cod_fullmatches_basic_mw_wz_2022,
                    '2023': cod_fullmatches_basic_mw_wz_2023,
                },
            },
        }
        self.FULLMATCHES_TABLE_DATA = {
            C.MW_MP: [
                create_table_data(C.MW_MP, table, source)
                for source, table in self.FULLMATCHES[C.MW_MP].items()
            ],
            C.MW_WZ: [
                create_table_data(C.MW_WZ, table, source)
                for source, tables in self.FULLMATCHES[C.MW_WZ].items()
                for table in tables.values()
            ],
        }

    def fullmatches_table(
        self,
        game_mode: GameMode,
        source: MatchesSource,
        year: YearWzTable | None = None,
    ):
        if game_mode == C.MW_WZ and year:
            table = self.FULLMATCHES[game_mode][source].get(year)
        else:
            table = self.FULLMATCHES[game_mode][source]

        return create_table_data(game_mode, table, source)

    def fullmatches_tables(
        self,
        game_mode: Literal['mw_mp', 'mw_wz', 'all'],
        source: MatchesSource,
        year: YearWzTable | None = None,
    ):
        tables = []

        if game_mode == C.ALL:
            for _tables in self.FULLMATCHES_TABLE_DATA.values():
                tables.extend(_tables)

        elif _tables := self.FULLMATCHES_TABLE_DATA.get(game_mode):
            tables.extend(_tables)

        if source != C.ALL:
            tables = [t for t in tables if t.source == source]

        if year and game_mode == C.MW_WZ:
            tables = [t for t in tables if year in t.name]

        return tables


class StoreLabelIndexes(TrackerFullmatches):
    '''Index Label names'''

    def __init__(self):
        super().__init__()
        self.map = cod_label_map
        self.mode = cod_label_mode
        self.games_stats = cod_label_games_stats
        self.weapons = cod_label_weapons
        self.attachments = cod_label_attachments
        self.perks = cod_label_perks
        self.killstreaks = cod_label_killstreaks
        self.tactical = cod_label_tactical
        self.lethal = cod_label_lethal

        self.label_tables: dict[LabelType, object] = {
            C.MAP: self.map,
            C.MODE: self.mode,
            C.GAMES_STATS: self.games_stats,
            'weapons': self.weapons,
            'attachments': self.attachments,
            'perks': self.perks,
            'killstreaks': self.killstreaks,
            'tactical': self.tactical,
            'lethal': self.lethal,
        }


class StoreTrackerTables(StoreLabelIndexes):
    '''Tables for tracker'''

    def __init__(self):
        super().__init__()
        self.cod_logs = cod_logs
        self.cod_logs_player = cod_logs_player
        self.cod_logs_error = cod_logs_error
        self.cod_logs_search = cod_logs_search
        self.cod_logs_task_queues = cod_logs_task_queues

    def get_table(
        self,
        game_mode: GameMode,
        source: MatchesSource = C.MATCHES,
        year: YearWzTable | None = None,
    ):
        if game_mode == C.ALL:
            table = None
        elif source == C.MATCHES:
            table = self.matches_table(game_mode, source)
        elif source in (C.MAIN, C.BASIC, C.ALL):
            table = self.fullmatches_table(game_mode, source, year)
        else:
            table = None

        return table

    def get_tables(
        self,
        game: Game,
        mode: Mode,
        source: MatchesSource,
        year: YearWzTable | None = None,
    ) -> list[TableGameData]:
        if source == C.MATCHES:
            return self.matches_tables(game, mode, source)

        game_mode = C.ALL if C.ALL in (game, mode) else f'{game}_{mode}'

        if source in (C.MAIN, C.BASIC, C.ALL) and game_mode in (
            C.ALL,
            C.MW_MP,
            C.MW_WZ,
        ):
            return self.fullmatches_tables(game_mode, source, year)

        return []

    def get_tables_all(
        self, game: Game, mode: Mode, year: YearWzTable | None = None
    ) -> list[TableGameData]:
        if game in (C.MW, C.ALL):
            game_mode = C.ALL if C.ALL in (game, mode) else f'{game}_{mode}'
            tables = self.fullmatches_tables(game_mode, C.ALL, year)
        else:
            tables = self.matches_tables(game, mode, C.MATCHES)

        return tables


STT = StoreTrackerTables()
