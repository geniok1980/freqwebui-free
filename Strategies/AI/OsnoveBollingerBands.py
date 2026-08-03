from freqtrade.strategy import IStrategy
import pandas as pd
import pandas_ta as ta

class OsnoveBollingerBands(IStrategy):
    timeframe = '15m'
    minimal_roi = {
        "0": 0.10
    }
    stoploss = -0.03
    trailing_stop = False
    process_only_new_candles = True
    use_exit_signal = True
    can_short = False

    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        # Bollinger Bands
        bb_indicator = ta.bbands(dataframe['close'], length=20, std=2)
        dataframe['bb_lower'] = bb_indicator['BBL_20_2.0']
        dataframe['bb_middle'] = bb_indicator['BBM_20_2.0']
        dataframe['bb_upper'] = bb_indicator['BBU_20_2.0']
        # RSI
        dataframe['rsi'] = ta.rsi(dataframe['close'], length=14)
        return dataframe

    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe['enter_long'] = False
        # Вход: цена касается нижней полосы BB и RSI < 35
        condition = (
            (dataframe['close'] <= dataframe['bb_lower']) &
            (dataframe['rsi'] < 35)
        )
        dataframe.loc[condition, 'enter_long'] = True
        return dataframe

    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe['exit_long'] = False
        # Выход: цена касается средней линии или верхней полосы BB
        condition = (
            (dataframe['close'] >= dataframe['bb_middle']) |
            (dataframe['close'] >= dataframe['bb_upper'])
        )
        dataframe.loc[condition, 'exit_long'] = True
        return dataframe
