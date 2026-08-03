from freqtrade.strategy import IStrategy
import pandas_ta as ta
import numpy as np

class PeresecheniiSma20(IStrategy):
    timeframe = '30m'
    minimal_roi = {
        "0": 0.0
    }
    stoploss = -0.04
    trailing_stop = False
    process_only_new_candles = True
    use_exit_signal = True
    # can_short not used, только лонг
    def populate_indicators(self, dataframe, metadata):
        # Расчет SMA 20 и SMA 50
        dataframe['sma20'] = ta.sma(dataframe['close'], length=20)
        dataframe['sma50'] = ta.sma(dataframe['close'], length=50)
        # Расчет среднего объема
        dataframe['vol_mean'] = dataframe['volume'].rolling(window=20).mean()
        # Расчет пересечения SMA
        dataframe['sma_cross_up'] = (dataframe['sma20'] > dataframe['sma50']) & (dataframe['sma20'].shift(1) <= dataframe['sma50'].shift(1))
        dataframe['sma_cross_down'] = (dataframe['sma20'] < dataframe['sma50']) & (dataframe['sma20'].shift(1) >= dataframe['sma50'].shift(1))
        return dataframe

    def populate_entry_trend(self, dataframe, metadata):
        dataframe['enter_long'] = False
        # Входим, когда происходит пересечение SMA снизу вверх и объем выше среднего
        condition = (
            dataframe['sma_cross_up'] &
            (dataframe['volume'] > dataframe['vol_mean'])
        )
        dataframe.loc[condition, 'enter_long'] = True
        return dataframe

    def populate_exit_trend(self, dataframe, metadata):
        dataframe['exit_long'] = False
        # Выход при обратном пересечении SMA (пересечение сверху вниз)
        condition = (
            dataframe['sma_cross_down']
        )
        dataframe.loc[condition, 'exit_long'] = True
        return dataframe
