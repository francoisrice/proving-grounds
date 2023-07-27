require("dotenv").config();

import { LocalStorage } from "node-localstorage";

const localstorage = new LocalStorage("./localstorage");

export const fetchDate = () => {
	if (process.env.ENV?.toUpperCase().includes("BACKTEST")) {
		var timestamp = localstorage.getItem("timestamp");
		var count = 0;
		while (!timestamp) {
			timestamp = localstorage.getItem("timestamp");
			count++;
			if (count > 5) {
				console.log(
					"Stuck fetching current Timestamp in aggregateTrades() - mongo.ts"
				);
			}
		}

		return new Date(timestamp);
	} else {
		return new Date();
	}
};

export const fetchCandles = async (candleNum: number) => {
	if (process.env.ENV?.toUpperCase().includes("BACKTEST")) {
		var candles = localstorage.getItem("candles");
		var count = 0;
		while (!candles) {
			candles = localstorage.getItem("candles");
			count++;
			if (count > 5) {
				console.log(
					"Stuck fetching current Timestamp in aggregateTrades() - mongo.ts"
				);
			}
		}
		return JSON.parse(candles).slice(candles.length - candleNum, candleNum);
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
					"Stuck fetching current Timestamp in aggregateTrades() - mongo.ts"
				);
			}
		}

		return parseFloat(price);
	}
};
