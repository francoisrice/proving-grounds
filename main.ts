require("dotenv").config();
import * as fs from "fs";
import * as csv from "csv-parser";
import ProgressBar from "progress";

import { updateCurrentAlgo } from "./test-algorithm/mongo";
import { LocalStorage } from "node-localstorage";
// import { main } from "./test-algorithm/main";
import { main } from "./test-algorithm/btc-chimera-main";
// import { main } from "./test-algorithm/bb-reversal-1min-main";
// import { main } from "./test-algorithm/bb-breakout-1min-main";
// import { main } from "./test-algorithm/new-monthly-high-main";
import { TradeInfo } from "./test-algorithm/types";
// main should fetch price or candles from fetcher

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

var progressBar = new ProgressBar("[:bar] :percent :etas", {
	total: 100,
});

const algo = process.env.ALGO;
// const algo = "bb-reversal-1min-btc-v0_1";
// const algo = "bb-reversal-v0_1";

const localstorage = new LocalStorage(`./test-algorithm/${algo}-localstorage`);

const initiateResultsFiles = () => {
	fs.writeFileSync(`results/${algo}-entries.json`, JSON.stringify([]));
	fs.writeFileSync(`results/${algo}-exits.json`, JSON.stringify([]));
	fs.writeFileSync(`results/${algo}-trades.json`, JSON.stringify([]));
};

const calculateTotalProfit = (trades: TradeInfo[]) => {
	// const trades = JSON.parse(fs.readFileSync("results/trades.json", "utf-8"));
	let profit = 0;
	let profitPercent = 1;
	trades.forEach((trade: TradeInfo) => {
		profit += trade["profitAbsolute"];
		profitPercent *= 1 + trade["profitPercent"];
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
	const startingMinute = new Date(parseInt(startTimestamp) * 1000);
	const endingMinute = new Date(parseInt(endTimestamp) * 1000);
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
		`results/${startingMinute.toDateString()}-${endingMinute.toDateString()}-${algo}-output.json`,
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

const pullTestData = () => {
	if (process.env.TEST_DATA_LOCATION === "DISC") {
		const testData = JSON.parse(
			fs.readFileSync(
				"data/Sun Jul 31 2022 to Thu Aug 24 2023 (new).json",
				// "data/1-min_data_2012-01-01_to_2021-03-31_timestamp_weighted_price.json",
				// "data/bear/1-min_data_2012-01-01_to_2021-03-31_timestamp_weighted_price.json",
				// "data/bull/1-min_data_2012-01-01_to_2013-12-01_timestamp_weighted_price.json", // Bull #1
				// "data/bull/1-min_data_2015-10-26_to_2017-12-16_timestamp_weighted_price.json", // Bull #2
				// "data/bull/1-min_data_2020-03-18_to_2021-03-31_timestamp_weighted_price.json", // Bull #3
				// "data/crab/1-min_data_2015-01-13_to_2015-10-26_timestamp_weighted_price.json", // Crab #1
				// "data/crab/1-min_data_2018-06-25_to_2018-11-08_timestamp_weighted_price.json", // Crab #2
				// "data/crab/1-min_data_2018-12-12_to_2019-03-31_timestamp_weighted_price.json", // Crab #3
				"utf-8"
			)
		);
		return testData;
	} else if (process.env.TEST_DATA_LOCATION === "DB") {
		// Pull Test data based on specific time range
	} else {
		// Pull Test data based on specific time range
	}
};

const createTimeFrameCandles = (testData: any[], timeFrameString: string) => {
	const timeFrameMapper: any = {
		"1min": 1,
		"5min": 5,
		"15min": 15,
		"30min": 30,
		"1h": 60,
		"4h": 240,
		"1d": 1440,
		"3d": 1440 * 3,
		"1w": 10080,
		"1mon": 43800,
	};

	var newData: any[] = [];
	var currentCandle: any = {
		open: 0,
		close: 0,
		high: 0,
		low: 0,
	};

	const minutesInTimeFrame: number = timeFrameMapper[timeFrameString];

	testData.forEach((price: any, index: number) => {
		if (index % minutesInTimeFrame === 0) {
			currentCandle.open = parseFloat(price["Weighted_Price"]);
			currentCandle.low = parseFloat(price["Weighted_Price"]);
		}
		currentCandle.high = Math.max(
			currentCandle.high,
			parseFloat(price["Weighted_Price"])
		);
		currentCandle.low = Math.min(
			currentCandle.low,
			parseFloat(price["Weighted_Price"])
		);

		if (index % minutesInTimeFrame === minutesInTimeFrame - 1) {
			currentCandle.close = parseFloat(price["Weighted_Price"]);
			newData.push({ Timestamp: price["Timestamp"], candle: currentCandle });
			currentCandle = {
				open: 0,
				close: 0,
				high: 0,
				low: 0,
			};
		}
	});

	return newData;
};

const createBitstampTimeFrameCandles = (
	testData: any[],
	timeFrameString: string
) => {
	const timeFrameMapper: any = {
		"1min": 1,
		"5min": 5,
		"15min": 15,
		"30min": 30,
		"1h": 60,
		"4h": 240,
		"1d": 1440,
		"3d": 1440 * 3,
		"1w": 10080,
		"1mon": 43800,
	};

	var newData: any[] = [];
	var currentCandle: any = {
		open: 0,
		close: 0,
		high: 0,
		low: 0,
	};

	const minutesInTimeFrame: number = timeFrameMapper[timeFrameString];

	testData.forEach((price: any, index: number) => {
		if (index % minutesInTimeFrame === 0) {
			currentCandle.open = parseFloat(price["open"]);
			currentCandle.low = parseFloat(price["low"]);
		}
		currentCandle.high = Math.max(
			currentCandle.high,
			parseFloat(price["high"])
		);
		currentCandle.low = Math.min(currentCandle.low, parseFloat(price["low"]));

		if (index % minutesInTimeFrame === minutesInTimeFrame - 1) {
			currentCandle.close = parseFloat(price["close"]);
			newData.push({ Timestamp: price["timestamp"], candle: currentCandle });
			currentCandle = {
				open: 0,
				close: 0,
				high: 0,
				low: 0,
			};
		}
	});

	return newData;
};

// TODO: Modify test algorithm main to pull candles/price from fetcher
if (process.env.PRICE_FETCH?.toUpperCase().includes("CANDLE")) {
	const candleNumberString = process.env.CANDLE_NUMBER;
	if (candleNumberString === undefined) {
		throw new Error("CANDLE_NUMBER not set in Environment Variables");
	}
	const timeFrameString = process.env.TIMEFRAME;
	if (timeFrameString === undefined) {
		throw new Error("TIMEFRAME not set in Environment Variables");
	}

	const candleNum = parseInt(candleNumberString);

	(async () => {
		const testData: any[] = pullTestData();

		console.log(`Test Data: ${testData.length}`);

		// const processedData = createTimeFrameCandles(testData, timeFrameString);
		const processedData = createBitstampTimeFrameCandles(
			testData,
			timeFrameString
		);

		console.log(`Test Data candles: ${processedData.length}`);

		await updateCurrentAlgo("cash");

		var progressBar = new ProgressBar("[:bar] :percent :etas", {
			total: processedData.length - candleNum,
		});

		for (let i = 0; i < processedData.length - candleNum; i++) {
			progressBar.tick();

			// Set timestamp and candles for test algorithm
			localstorage.setItem("timestamp", processedData[i]["timestamp"]);
			localstorage.setItem(
				"candles",
				JSON.stringify(
					processedData.slice(i, i + candleNum).map((candle) => {
						return {
							...candle.candle,
						};
					})
				)
			);

			await main();
		}

		// Create results JSON
		createFinalResultsFile(
			processedData[0]["Timestamp"],
			processedData[processedData.length - 1]["Timestamp"]
		);
	})();
} else {
	(async () => {
		const timeFrameString = process.env.TIMEFRAME;
		if (timeFrameString === undefined) {
			throw new Error("TIMEFRAME not set in Environment Variables");
		}
		const testData: any[] = pullTestData();

		const processedData = createTimeFrameCandles(testData, timeFrameString);

		var progressBar = new ProgressBar("[:bar] :percent :etas", {
			total: processedData.length,
		});

		processedData.forEach(async (data) => {
			progressBar.tick();

			// Set timestamp and price for test algorithm
			localstorage.setItem("timestamp", data["Timestamp"]);
			localstorage.setItem("price", data.candle.close);

			await main();
		});

		// Create results JSON
		createFinalResultsFile(
			processedData[0]["Timestamp"],
			processedData[processedData.length - 1]["Timestamp"]
		);
	})();
}
