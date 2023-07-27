import { LocalStorage } from "node-localstorage";
import { mean, std } from "mathjs";
import {
	fetchAlgoParams,
	newSellInterrupt,
	sendEntryInfoToDB,
	sendExitInfoToDB,
	sendTradeInfoToDB,
} from "./mongo";
import { fetchDate, fetchCandles } from "./fetcher";
import { TradeInfo } from "./types";

const api_key: string = process.env.COINBASE_API_KEY || "";
const api_secret: string = process.env.COINBASE_API_SECRET || "";

const isLiveTrading: boolean =
	(process.env.LIVE_TRADING || "false").toUpperCase().includes("T") ||
	(process.env.LIVE_TRADING || "false").toUpperCase().includes("Y");

// const algo: string = process.env.ALGO || "bb-reversal-1min-btc-v0_1";
const algo: string = "bb-reversal-1min-v0_1_1";

const localstorage = new LocalStorage(`./test-algorithm/${algo}-localstorage`);

/*
* Change profitTarget
* Change trailingStop
* Change timedExit
* Adjust Bands
* Adjust SMA - longer makes bands more stable, and less reactive to current prices

* Adjust Candles for more macro, longer term trades
*/

/*
Crab:
1. - Buy at lower band, sell at upper band, no other settings
2. - Buy at lower band, sell at SMA
3. - Buy at lower band, sell at SMA, 0.002 trailing stop
4. - Buy at lower band, sell at SMA, 0.001 trailing stop
5. - Buy at lower band, sell at upper band, 0.002 trailing stop
6. - Buy at lower band, sell at upper band, 0.001 trailing stop
7. - Buy at lower band, sell at upper band, 0.001 trailing stop, 28800 candle timed exit
8. - Lower band at 1.5 std devs (93% chance to increase), trailing stop at 0.001 
9. - Lower band at 1.5 std devs (93% chance to increase), trailing stop at 0.002 
10. - Lower band at 1.5 std devs (93% chance to increase), trailing stop at 0.005 
11. - Lower band at 1.0 std devs (84% chance to increase), trailing stop at 0.001 
12. - Lower band at 1.0 std devs (84% chance to increase), trailing stop at 0.002 
13. - Lower band at 1.0 std devs (84% chance to increase), trailing stop at 0.005 
*/

const profitTarget = null; // 0.002;
// const stopLoss = 0.005; // Made redundant by trailingStop
// const takeProfit = null; // Same as profitTarget
const trailingStop = null; // 0.001;
// const breakEven = null; // Move stop loss to entry price when price reaches this value - taken care of by trailingStop
const timedExit = null; // 28800; // 8 hours by number of candles
// No special filters for this algo

// Bollinger Band Settings
const smaLength = 20;
const stdDevBandDistance = 2;

// entry at low band
// exit at sma, high band, trailing stop, or take profit

var isPositionOpen: boolean = false;
var upperBand: number = 0;
var lowerBand: number = 0;

// const fetchCandles = async (candleNumber: number): Promise<any> => {
// 	const response = await fetch(
// 		`https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=60&limit=${candleNumber}`,
// 		{ method: "GET" }
// 	);
// 	const responseData = await response.json();

// 	return responseData.data.ohlc;
// };

const isSellConditionMet = (
	currentCandle: any,
	// previousCandle: any,
	// upperBand: any,
	entryPrice: string,
	currentTime: any,
	entryTime: string
): boolean => {
	// ******** DO NOT DELETE ********
	// if (currentCandle.close >= upperBand) {
	// 	return true;
	// }
	// if (previousCandle.close >= upperBand) {
	// 	return true;
	// }

	var entryDate: Date = new Date(entryTime);

	// profitTarget
	if (
		profitTarget &&
		currentCandle.close >= parseInt(entryPrice) * (1 + profitTarget)
	) {
		return true;
	}

	// trailingStop
	if (
		trailingStop &&
		currentCandle.close <= parseInt(entryPrice) * (1 - trailingStop)
	) {
		return true;
	}

	// timedExit
	if (
		timedExit &&
		currentTime.getTime() - entryDate.getTime() >= timedExit * 60000
	) {
		return true;
	}

	return false;
};

const convertStringsToInt = (candle: any): any => {
	return {
		close: parseInt(candle.close),
		high: parseInt(candle.high),
		low: parseInt(candle.low),
		open: parseInt(candle.open),
		timestamp: parseInt(candle.timestamp),
		volume: parseFloat(candle.volume),
	};
};

const createTrade = (currentTime: Date, exitPrice: number): TradeInfo => {
	const returnedEntryPrice = parseInt(
		localstorage.getItem("entryPrice-BTC") || "0"
	);
	if (returnedEntryPrice === 0) {
		var entryPrice: number = -1;
		var entryAmountUSD: number = -1;
		var profitAbsolute: number = 0;
		var profitPercent: number = 0;
	} else {
		entryPrice = returnedEntryPrice;
		profitAbsolute = exitPrice - entryPrice;
		profitPercent = exitPrice - entryPrice / entryPrice;

		const returnedAssetAmount = parseInt(
			localstorage.getItem("assetAmount-BTC") || "0"
		);
		if (returnedAssetAmount === 0) {
			entryAmountUSD = -1;
		} else {
			entryAmountUSD = returnedAssetAmount / entryPrice;
		}
	}

	const tradeDetails: TradeInfo = {
		algo,
		exitDatetime: currentTime,
		entryDatetime: new Date(localstorage.getItem("entryDatetime-BTC") || ""),
		mode: isLiveTrading ? "live" : "paper",
		entryPrice: entryPrice,
		entryAmountUSD,
		exitPrice,
		profitAbsolute,
		profitPercent,
	};

	return tradeDetails;
};

export const main = async () => {
	const { buyVar, sellVar } = await fetchAlgoParams(algo);
	var currentTime = fetchDate();
	if (await newSellInterrupt(algo)) {
		console.log(
			`${currentTime} New Sell Interrupt detected. Selling all positions.`
		);

		const candles = await fetchCandles(1);
		const currentCandle = convertStringsToInt(candles[0]);

		var base_size: number = calcBaseSize(currentCandle, sellVar);
		var orderResponse = await sendMockSellOrder(base_size);

		// Put logic for live trade here

		const order = await orderResponse;

		if (order.data.success === true) {
			isPositionOpen = false;
			const assetAmount = sellVar / currentCandle.close;
			console.log(
				`${currentTime} Sell Order successful. Sold ${assetAmount.toString()} BTC @ ${currentCandle.close.toString()}`
			);

			const exitResponse = await sendExitInfoToDB(algo, currentCandle.close);
			if (exitResponse?.acknowledged) {
				console.log(`${currentTime} Exit logged in Database.`);
			} else {
				console.log("Failed to send Exit to Database.");
			}

			const tradeInfo: TradeInfo = createTrade(
				currentTime,
				currentCandle.close
			);
			const response = await sendTradeInfoToDB(algo, tradeInfo);
			if (response?.acknowledged) {
				console.log(`${currentTime} Trade logged in Database.`);
			}
		}
	} else {
		var candles = await fetchCandles(20);
		var previousCandle = candles[18];
		var currentCandle = candles[19];

		console.log(currentCandle.close); // Let us know you're alive

		previousCandle = convertStringsToInt(previousCandle);
		currentCandle = convertStringsToInt(currentCandle);

		var sma20 = mean(candles.map((candle: any) => parseInt(candle.close)));
		var std20 = std(candles.map((candle: any) => parseInt(candle.close)));

		upperBand = sma20 + stdDevBandDistance * std20;
		lowerBand = sma20 - stdDevBandDistance * std20;

		if (
			!isPositionOpen &&
			previousCandle.low < lowerBand &&
			currentCandle.close > previousCandle.high
		) {
			// Open a position
			console.log(
				`${currentTime} Bullish Reversal Predicted. Buying a position @ ${currentCandle.close.toString()}`
			);

			// if (isLiveTrading) {
			// 	const orderResponse = await sendBuyOrder();
			// 	var order = await orderResponse.json();
			// } else {
			const orderResponse = await sendMockBuyOrder();
			var order = await orderResponse;
			// }

			if (order.data.success === true) {
				isPositionOpen = true;
				const assetAmount = parseInt(buyVar) / currentCandle.close;

				console.log(
					`${currentTime} Buy Order successful. Bought ${assetAmount.toString()} BTC @ ${currentCandle.close.toString()}`
				);

				const entryResponse = await sendEntryInfoToDB(
					algo,
					currentCandle.close
				);
				if (entryResponse?.acknowledged) {
					console.log(`${currentTime} Entry logged in Database.`);
				} else {
					console.log("Failed to send Entry to Database.");
				}

				localstorage.setItem(`assetAmount-BTC`, assetAmount.toString());
				localstorage.setItem(`entryPrice-BTC`, currentCandle.close.toString());
				localstorage.setItem(`entryDatetime-BTC`, currentTime.toString());
			}
		} else if (
			isPositionOpen
			// (currentCandle.close > upperBand || previousCandle.close > upperBand)
		) {
			const entryPrice = localstorage.getItem(`entryPrice-BTC`);
			var count = 0;
			while (!entryPrice) {
				const entryPrice = localstorage.getItem(`entryPrice-BTC`);
				count++;
				if (count > 5) {
					console.log(
						`Stuck fetching entryPrice in ${algo} - sell position - bb-reversal-main.ts`
					);
				}
			}

			const entryTime = localstorage.getItem(`entryDatetime-BTC`);
			count = 0;
			while (!entryTime) {
				const entryTime = localstorage.getItem(`entryDateTime-BTC`);
				count++;
				if (count > 5) {
					console.log(
						`Stuck fetching entryTime in ${algo} - sell position - bb-reversal-main.ts`
					);
				}
			}

			if (
				isSellConditionMet(currentCandle, entryPrice, currentTime, entryTime)
			) {
				// Close a position
				console.log(
					`${currentTime} Bearish Reversal Predicted. Selling a position @ ${currentCandle.close.toString()}`
				);

				var base_size: number = calcBaseSize(currentCandle, sellVar);

				// if (isLiveTrading) {
				// const orderResponse = await sendSellOrder();
				// const order = await orderResponse.json();
				// } else {
				const orderResponse = await sendMockSellOrder(base_size);
				const order = await orderResponse;
				// }

				if (order.data.success === true) {
					isPositionOpen = false;
					const assetAmount = parseInt(sellVar) / currentCandle.close;

					console.log(
						`${currentTime} Sell Order successful. Sold ${assetAmount.toString()} BTC @ ${currentCandle.close.toString()}`
					);

					const exitResponse = await sendExitInfoToDB(
						algo,
						currentCandle.close
					);
					if (exitResponse?.acknowledged) {
						console.log(`${currentTime} Exit logged in Database.`);
					} else {
						console.log("Failed to send Exit to Database.");
					}

					const tradeInfo: TradeInfo = createTrade(
						currentTime,
						currentCandle.close
					);
					const response = await sendTradeInfoToDB(algo, tradeInfo);
					if (response?.acknowledged) {
						console.log(`${currentTime} Trade logged in Database.`);
					}
				}
			}
		}
	}
};

const calcBaseSize = (currentCandle: any, sellVar: string): number => {
	var assetAmount: number;
	var entryPrice: number;
	var base_size: number;

	const assetAmountString = localstorage.getItem(`assetAmount-BTC`);
	if (!assetAmountString) {
		assetAmount = -1;
	} else {
		assetAmount = parseFloat(assetAmountString);
	}

	const entryPriceString = localstorage.getItem(`entryPrice-BTC`);
	if (!entryPriceString) {
		entryPrice = -1;
	} else {
		entryPrice = parseFloat(entryPriceString);
	}

	if (assetAmount > 0 && entryPrice > 0) {
		base_size = assetAmount * (currentCandle.close / entryPrice);
	} else {
		base_size = parseFloat(sellVar) / currentCandle.close;
	}

	return base_size;
};

const sendMockBuyOrder = async () => {
	return {
		status: "200",
		data: {
			success: true,
		},
	};
};

const sendMockSellOrder = async (base_size: number) => {
	return {
		status: "200",
		data: {
			success: true,
		},
	};
};

// When running in production
// console.log(`Starting ${algo} ...`);
// setInterval(async () => {
// 	await main();
// }, 60000);
