from apps.base.schemas.main import C

from apps.tracker.schemas.main import Game, Mode, GameMode


class StoreGameModes:
    def __init__(self):
        '''Global store game modes for tracker'''

        self._game_modes: dict[GameMode, tuple[Game, Mode]] = {
            C.ALL: (C.ALL, C.ALL),
            C.MW_MP: (C.MW, C.MP),
            C.MW_WZ: (C.MW, C.WZ),
            C.CW_MP: (C.CW, C.MP),
            C.VG_MP: (C.VG, C.MP),
        }
        self._mode_games: dict[tuple[Game, Mode], GameMode] = {
            v: k for k, v in self._game_modes.items()
        }

    def is_game_mode(self, game_mode: GameMode):
        return game_mode in self._game_modes

    def is_game_mode_mw(self, game_mode: GameMode):
        return game_mode in (C.MW_MP, C.MW_WZ)

    def desctruct_game_mode(self, game_mode: GameMode):
        return self._game_modes[game_mode]

    def modes(
        self, game: Game | None = None, mode: Mode | None = None
    ) -> dict[GameMode, tuple[Game, Mode]]:
        if game is None and mode is None:
            return {
                game_mode: v
                for game_mode, v in self._game_modes.items()
                if game_mode != C.ALL
            }

        if game == C.ALL and mode == C.ALL:
            return self._game_modes

        if mode in (C.ALL, None):
            return {
                game_mode: (_game, _mode)
                for game_mode, (_game, _mode) in self._game_modes.items()
                if game == _game
            }

        game_mode = f'{game}_{mode}'

        if game_mode in self._game_modes:
            return {game_mode: self._game_modes[game_mode]}

        return self._game_modes


SGM = StoreGameModes()
