require("dotenv").config();
import * as fs from "fs";
import * as csv from "csv-parser";
import { LocalStorage } from "node-localstorage";
import { main } from "./test-algorithm/main";
// main should fetch price or candles from fetcher

const localstorage = new LocalStorage("./test-algorithm/localstorage");

const pullTestData = () => {
	if (process.env.TEST_DATA_LOCATION === "DISC") {
		const testData = JSON.parse(
			fs.readFileSync(
				"data/1-min_data_2012-01-01_to_2021-03-31_timestamp_weighted_price.json",
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
					.map((candle) => candle["Weighted_Price"])
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
