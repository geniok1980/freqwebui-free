from freqtrade.strategy import IStrategy
import pandas_ta as ta
import numpy as np

class ПростаяEmaКроссовере(IStrategy):
    timeframe = '1h'
    minimal_roi = {
        "0": 0.0
    }
    stoploss = -0.05
    trailing_stop = False
    process_only_new_candles = True
    use_exit_signal = True
    can_short = False

    def populate_indicators(self, dataframe, metadata):
        # Calculate EMA50 and EMA200
        dataframe['ema50'] = ta.ema(dataframe['close'], length=50)
        dataframe['ema200'] = ta.ema(dataframe['close'], length=200)
        # Calculate RSI
        dataframe['rsi'] = ta.rsi(dataframe['close'], length=14)
        return dataframe

    def populate_entry_trend(self, dataframe, metadata):
        # Entry conditions:
        # EMA50 crosses above EMA200
        # RSI > 50
        # To detect cross, compare current and previous values
        dataframe['ema50_prev'] = dataframe['ema50'].shift(1)
        dataframe['ema200_prev'] = dataframe['ema200'].shift(1)

        # Bullish crossover
        condition_cross_up = (
            (dataframe['ema50_prev'] < dataframe['ema200_prev']) &
            (dataframe['ema50'] > dataframe['ema200'])
        )

        condition_rsi = dataframe['rsi'] > 50

        dataframe['enter_long'] = (
            condition_cross_up &
            condition_rsi
        ).astype(int)

        return dataframe

    def populate_exit_trend(self, dataframe, metadata):
        # Exit condition:
        # EMA50 crosses below EMA200
        dataframe['ema50_prev'] = dataframe['ema50'].shift(1)
        dataframe['ema200_prev'] = dataframe['ema200'].shift(1)

        condition_cross_down = (
            (dataframe['ema50_prev'] > dataframe['ema200_prev']) &
            (dataframe['ema50'] < dataframe['ema200'])
        )

        dataframe['exit_long'] = condition_cross_down.astype(int)

        return dataframe
