require("dotenv").config();
import * as fs from "fs";
import * as csv from "csv-parser";
import { LocalStorage } from "node-localstorage";
// import { main } from "./test-algorithm/main";
import { main } from "./test-algorithm/bb-reversal-1min-main";
// import { main } from "./test-algorithm/new-monthly-high-main";
import { TradeInfo } from "./test-algorithm/types";
// main should fetch price or candles from fetcher

const localstorage = new LocalStorage("./test-algorithm/localstorage");

/*
bollinger band breakout
bollinger band reversal
Turtle?

Bull:
MA crossover + 

Crab:
bb-reversal-1min

Bear:
	Capitalize on small bullish pumps within the bearish trend
MA crossover
Fibonacci Retracement
*/

const algo = process.env.ALGO;
// const algo = "bb-reversal-1min-btc-v0_1";
// const algo = "bb-reversal-v0_1";

const pullTestData = () => {
	if (process.env.TEST_DATA_LOCATION === "DISC") {
		const testData = JSON.parse(
			fs.readFileSync(
				// "data/bear/1-min_data_2012-01-01_to_2021-03-31_timestamp_weighted_price.json",
				"data/crab/1-min_data_2015-01-13_to_2015-10-26_timestamp_weighted_price.json",
				"utf-8"
			)
		);
		return JSON.parse(testData);
	} else if (process.env.TEST_DATA_LOCATION === "DB") {
		// Pull Test data based on specific time range
	} else {
		// Pull Test data based on specific time range
	}
};

const initiateResultsFiles = () => {
	fs.writeFileSync(`results/${algo}-entries.json`, JSON.stringify([]));
	fs.writeFileSync(`results/${algo}-exits.json`, JSON.stringify([]));
	fs.writeFileSync(`results/${algo}-trades.json`, JSON.stringify([]));
};

const calculateTotalProfit = (trades: TradeInfo[]) => {
	// const trades = JSON.parse(fs.readFileSync("results/trades.json", "utf-8"));
	let profit = 0;
	let profitPercent = 0;
	trades.forEach((trade: TradeInfo) => {
		profit += trade["profitAbsolute"];
		profitPercent += trade["profitPercent"];
	});
	return { profit, profitPercent };
};

const calculateTotalProfitPercent = () => {
	const trades = JSON.parse(
		fs.readFileSync(`results/${algo}-trades.json`, "utf-8")
	);
	let profit = 0;
	trades.forEach((trade: TradeInfo) => {
		profit += trade["profitPercent"];
	});
	return profit;
};

const calculateMaxConsecutiveLossingTrades = (trades: TradeInfo[]) => {
	// const trades = JSON.parse(fs.readFileSync("results/trades.json", "utf-8"));
	let maxConsecutiveLossingTrades = 0;
	let currentConsecutiveLossingTrades = 0;
	trades.forEach((trade: TradeInfo) => {
		if (trade["profitPercent"] < 0) {
			currentConsecutiveLossingTrades++;
		} else {
			if (currentConsecutiveLossingTrades > maxConsecutiveLossingTrades) {
				maxConsecutiveLossingTrades = currentConsecutiveLossingTrades;
			}
			currentConsecutiveLossingTrades = 0;
		}
	});
	return maxConsecutiveLossingTrades;
};

const calculateMaxLoss = (trades: TradeInfo[]) => {
	let maxLoss = 0;
	let currentLoss = 0;
	trades.forEach((trade: TradeInfo) => {
		if (trade["profitAbsolute"] < 0) {
			currentLoss += trade["profitAbsolute"];
		} else {
			if (currentLoss < maxLoss) {
				maxLoss = currentLoss;
			}
			currentLoss = 0;
		}
	});
	return maxLoss;
};

const calculateMaxAbsoluteLoss = (trades: TradeInfo[]) => {
	// From the saved trade data, calculate the lowest point the account reached
	let maxAbsoluteLoss = 0;
	let currentAbsoluteLoss = 0;
	trades.forEach((trade: TradeInfo) => {
		currentAbsoluteLoss += trade["profitAbsolute"];
		if (currentAbsoluteLoss < maxAbsoluteLoss) {
			maxAbsoluteLoss = currentAbsoluteLoss;
		}
	});
	return maxAbsoluteLoss;
};

const calculatePercentOfProfitableTrades = (trades: TradeInfo[]) => {
	let profitableTrades = 0;
	trades.forEach((trade: TradeInfo) => {
		if (trade["profitPercent"] > 0) {
			profitableTrades++;
		}
	});
	return (profitableTrades / trades.length).toFixed(5);
};

const createFinalResultsFile = (
	startTimestamp: string,
	endTimestamp: string
) => {
	const startingMinute = new Date(parseFloat(startTimestamp) * 1000);
	const endingMinute = new Date(parseFloat(endTimestamp) * 1000);
	const trades = JSON.parse(
		fs.readFileSync(`results/${algo}-trades.json`, "utf-8")
	);

	// Profit
	const { profit, profitPercent } = calculateTotalProfit(trades);

	// Profit Percentage
	// const profitPercent: string = calculateTotalProfitPercent();

	// Max Consecutive Lossing Trades
	const maxConsecutiveLossingTrades: number =
		calculateMaxConsecutiveLossingTrades(trades);

	// Max Loss
	// const maxLoss: number = calculateMaxLoss(trades);

	// Max Loss below initial investment
	const maxAbsoluteLoss: number = calculateMaxAbsoluteLoss(trades);

	// Number of Trades
	const totalTrades: number = trades.length;

	// % of Profitable Trades
	const percentOfProfitableTrades: string =
		calculatePercentOfProfitableTrades(trades);

	// (Avg Profit % of winning trades)
	// (Avg Loss % of lossing trades)

	// (Avg profit per week)
	// (Avg profit per month)

	// (Lowest % drop of winning trade)

	fs.writeFileSync(
		`results/${startingMinute}-${endingMinute}-${algo}-output.json`,
		JSON.stringify({
			"Start Time": startingMinute,
			"End Time": endingMinute,
			"Total Profit ($)": profit,
			"Total Profit (%)": profitPercent,
			"Max Consecutive Lossing Trades": maxConsecutiveLossingTrades,
			// "Max USD Loss": maxLoss,
			"Max drop from initial investment ($)": maxAbsoluteLoss,
			"Percent of Profitable Trades": percentOfProfitableTrades,
		})
	);
};

initiateResultsFiles();

// TODO: Modify test algorithm main to pull candles/price from fetcher
if (process.env.PRICE_FETCH?.toUpperCase().includes("CANDLE")) {
	const candleNumberString = process.env.CANDLE_NUMBER;
	if (candleNumberString === undefined) {
		throw new Error("CANDLE_NUMBER not set in Environment Variables");
	}
	const candleNum = parseInt(candleNumberString);

	(async () => {
		const testData: any[] = pullTestData();

		for (let i = candleNum - 1; i < testData.length; i++) {
			// Set timestamp and candles for test algorithm
			localstorage.setItem("timestamp", testData[i]["Timestamp"]);
			localstorage.setItem(
				"candles",
				testData
					.slice(i + 1 - candleNum, candleNum)
					.map((candle) => {
						return {
							close: candle["Weighted_Price"],
							high: candle["Weighted_Price"],
							low: candle["Weighted_Price"],
							open: candle["Weighted_Price"],
						};
					})
					.toString()
			);

			main();
		}

		// Results collection and Test Reporting
		// 		Where to store buys, sells, and tradeInfo?
		// 		localstorage("entry")
		// 		localstorage("exit")
		// 		After storing in localstorage(exit), tally exit/entry gain/loss and write to file/memory

		// Create results JSON
		createFinalResultsFile(testData[0], testData[testData.length - 1]);
	})();
} else {
	(async () => {
		const testData: any[] = pullTestData();

		testData.forEach((data) => {
			// Set timestamp and price for test algorithm
			localstorage.setItem("timestamp", data.price);
			localstorage.setItem("price", data.price);

			main();
		});

		// Results collection and Test Reporting
		// Test cleanup
	})();
}
