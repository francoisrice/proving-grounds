# Tests to write

## Main function

- pullTestData?
- createTimeFrameCandles
- Each Final Result Calculation

## BB Reversal 1min Main

- isSellConditionMet() for `bb-reversal-1min-main`
  - [ ] `isSellConditionMet()` returns `True` when `close` is above `upperBB` and `upperBand` is active
  - [ ] `isSellConditionMet()` returns `True` when `timedExit` is active and `currentTime` is greater than
  - `profitTarget`
  - `trailingStop`
  -
- SMA Calculation
- SMA variables
  - Length
  - Std Devs

## BB Breakout 1min Main

- isSellConditionMet() for `bb-breakout-1min-main`
  - [ ] `isSellConditionMet()` returns `True` when `close` is below `lowerBB` and `lowerBand` is active
  - [ ] `isSellConditionMet()` returns `True` when `timedExit` is active and `currentTime` is greater than
  - `profitTarget`
  - `trailingStop`
  -
- SMA Calculation
- SMA variables
  - Length
  - Std Devs
