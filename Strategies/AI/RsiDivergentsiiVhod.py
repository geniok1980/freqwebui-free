from freqtrade.strategy import IStrategy
import numpy as np
import pandas_ta as ta


class RsiDivergentsiiVhod(IStrategy):
    timeframe = '1h'
    minimal_roi = {
        "0": 0.0
    }
    stoploss = -0.025
    trailing_stop = False
    process_only_new_candles = True
    use_exit_signal = True
    can_short = False

    def populate_indicators(self, dataframe, metadata):
        # RSI indicator
        rsi = ta.rsi(dataframe['close'], length=14)
        dataframe['rsi'] = rsi

        # Detect RSI divergence - for simplification, we'll check for RSI crossing above 30 from below
        dataframe['rsi_prev'] = dataframe['rsi'].shift(1)
        dataframe['rsi_cross_up'] = ((dataframe['rsi_prev'] < 30) & (dataframe['rsi'] >= 30))
        
        # Optional: identify higher lows/higher highs for divergence detection - simplifying to RSI crossing as trigger
        return dataframe

    def populate_entry_trend(self, dataframe, metadata):
        dataframe['enter_long'] = (
            (dataframe['rsi_cross_up'])  # RSI crossing above 30 from below
        ).astype('float')
        return dataframe

    def populate_exit_trend(self, dataframe, metadata):
        # Exit when RSI exceeds 70
        dataframe['exit_long'] = (
            (dataframe['rsi'] > 70)
        ).astype('float')
        return dataframe
