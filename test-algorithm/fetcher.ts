require("dotenv").config();

import { LocalStorage } from "node-localstorage";

const algo = process.env.ALGO;

const localstorage = new LocalStorage(`./test-algorithm/${algo}-localstorage`);

export const fetchDate = () => {
	if (process.env.ENV?.toUpperCase().includes("BACKTEST")) {
		var timestamp = localstorage.getItem("timestamp");
		var count = 0;
		while (!timestamp) {
			timestamp = localstorage.getItem("timestamp");
			count++;
			if (count > 5) {
				console.log(
					"Stuck fetching current Timestamp in fetchDate() - fetcher.ts"
				);
			}
		}

		return new Date(parseInt(timestamp) * 1000);
	} else {
		return new Date();
	}
};

export const fetchCandles = async (candleNum: number): Promise<any> => {
	if (process.env.ENV?.toUpperCase().includes("BACKTEST")) {
		var candlesJSONObj: any = localstorage.getItem("candles");
		var count = 0;
		while (!candlesJSONObj) {
			candlesJSONObj = localstorage.getItem("candles");
			count++;
			if (count > 5) {
				console.log(
					"Stuck fetching current candles in fetchCandles() - fetcher.ts"
				);
			}
		}

		const candlesArray = JSON.parse(candlesJSONObj);
		const candles = candlesArray.slice(
			candlesArray.length - candleNum,
			candleNum
		);
		return Promise.resolve(candles);
	} else {
		const response = await fetch(
			`https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=60&limit=${candleNum}`,
			{ method: "GET" }
		);
		const responseData = await response.json();

		return responseData.data.ohlc;
	}
};

export const fetchPrice = async () => {
	if (process.env.ENV?.toUpperCase().includes("BACKTEST")) {
		var price = localstorage.getItem("price");
		var count = 0;
		while (!price) {
			price = localstorage.getItem("candles");
			count++;
			if (count > 5) {
				console.log(
					"Stuck fetching current candle in fetchPrice() - fetcher.ts"
				);
			}
		}

		return parseFloat(price);
	}
};

export const fetchThreeDayCandle = async () => {
	if (process.env.ENV?.toUpperCase().includes("BACKTEST")) {
		var candlesJSONObj: any = localstorage.getItem("candles");
		var count = 0;
		while (!candlesJSONObj) {
			candlesJSONObj = localstorage.getItem("candles");
			count++;
			if (count > 5) {
				console.log(
					"Stuck fetching current candles in fetchCandles() - fetcher.ts"
				);
			}
		}

		const candlesArray = JSON.parse(candlesJSONObj);
		// const candles = candlesArray.slice(candlesArray.length - 1, 1);
		const candles = candlesArray;
		return Promise.resolve(candles);
	} else {
		const response = await fetch(
			`https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=259200&limit=1`,
			{ method: "GET" }
		);
		const responseData = await response.json();

		return responseData.data.ohlc[0];
	}
};
