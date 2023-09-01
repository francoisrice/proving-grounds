require("dotenv").config();
import {
	getDatetime3daysAgo,
	aggregateTrades,
	fetchCurrentAlgo,
	updateAlgoSettingsACID,
	updateCurrentAlgo,
	sendSellInterrupt,
	sendTradeInfoToDB,
} from "./mongo";
import { fetchThreeDayCandle, fetchDate } from "./fetcher";
import { TradeInfo } from "./types";

const tradingBots = process.env.TRADING_BOTS?.split(",") || [];
console.log(`Using algorithms: `);
console.log(tradingBots); // Display connected algo's & notify that we're alive

const buyAndHold: string = process.env.BUY_AND_HOLD_BOT || "buy-and-hold";

var fees = 0;

const findMaxProfit = (profits: any[]) => {
	let maxProfit = profits[0];
	for (const profit of profits) {
		if (profit.grossProfitPercent > maxProfit.grossProfitPercent) {
			maxProfit = profit;
		}
	}
	return maxProfit;
};

const calcBuyAndHoldProfit = async () => {
	const candle = await fetchThreeDayCandle();

	const profit = (candle[0].close - candle[0].open) / candle[0].open;

	return profit;
};

const calcProfitOfCurrentAlgoAndSendToDB = async (
	currentAlgo: string,
	profits: any[]
) => {
	const currentAlgoProfit = profits.find((profit) => profit._id == currentAlgo);

	if (currentAlgoProfit) {
		const currentAlgoProfitPercent = currentAlgoProfit.grossProfitPercent;

		const date = fetchDate();
		const candle = await fetchThreeDayCandle();

		const tradeInfo: TradeInfo = {
			exitDatetime: date,
			entryDatetime: getDatetime3daysAgo(date),
			mode: "backtest",
			algo: currentAlgo,
			entryPrice: candle.open,
			exitPrice: candle.close,
			entryAmountUSD: 10000,
			profitAbsolute: 10000 * (1 + currentAlgoProfitPercent) - 10000,
			profitPercent: currentAlgoProfitPercent,
		};

		const response = await sendTradeInfoToDB("btc-chimera-1d", tradeInfo);
		if (response.acknowledged) {
			console.log(
				`Successfully sent ${currentAlgo} profit to database: ${currentAlgoProfitPercent}`
			);
		}
	}
};

// TODO: 1) Calculate unrealized profit for each algo & add to aggregated profits
// TODO: 2) If all profits are negative, then we should sell all assets and wait for a positive profit
export const main = async () => {
	var profits: any[] = [];
	var currentTime: Date = new Date();
	for (const algo of tradingBots) {
		const profit = await aggregateTrades(algo);

		// Check that a trade has been completed for this algo
		if (profit[0]) {
			profits.push(profit[0]);
		}
	}

	profits.push({
		_id: buyAndHold,
		grossProfitPercent: await calcBuyAndHoldProfit(),
	});

	profits.push({ _id: "cash", grossProfitPercent: 0 });

	console.log(profits);

	if (profits.length == 0) {
		console.log(`No available algos have completed a trade. Exiting...`);
		return;
	}

	const maxProfit = findMaxProfit(profits);

	console.log(`Max profit: ${maxProfit._id}`);

	const currentAlgo = await fetchCurrentAlgo();

	console.log(`Current algo: ${currentAlgo}`);

	if (process.env.ENV?.toUpperCase().includes("BACKTEST")) {
		await calcProfitOfCurrentAlgoAndSendToDB(currentAlgo, profits);
	}

	if (currentAlgo) {
		if (maxProfit._id == currentAlgo) {
			console.log(
				`${currentTime} ${maxProfit._id} is still generating the most profit. No changes needed. Exiting...`
			);
			return;
		} else {
			console.log(
				`${currentTime} ${maxProfit._id} is now creating more profit than ${currentAlgo}. Shifting funds...`
			);
			fees -= 0.007;
			console.log(`Fees: ${fees}`);

			const updateChimeraResponse = await updateCurrentAlgo(maxProfit._id);
			if (updateChimeraResponse.acknowledged) {
				console.log(
					`${currentTime} Successfully initiated fund transfer to ${maxProfit._id}!`
				);
			}

			// const updateAlgosResponse = await updateAlgoSettingsACID(
			// 	currentAlgo?.currentAlgo,
			// 	maxProfit._id
			// );

			// if (updateAlgosResponse?.acknowledged) {
			// 	const sellResult: boolean = await sendSellInterrupt(
			// 		currentAlgo?.currentAlgo,
			// 		maxProfit._id
			// 	);
			// 	if (sellResult) {
			// 		const updateChimeraResponse = await updateCurrentAlgo(maxProfit._id);
			// 		if (updateChimeraResponse.acknowledged) {
			// 			console.log(
			// 				`${currentTime} Successfully initiated fund transfer to ${maxProfit._id}!`
			// 			);
			// 		}
			// 	}
			// }
		}
	} else {
		console.log(
			`${currentTime} Bitcoin Chimera was not able to access settings from database. Exiting...`
		);
		return;
	}

	// Start trading bot with max profit
};

// setInterval(async () => {
// 	await main();
// }, 1000 * 60 * 60 * 24 * 3); // Run every 3 days
