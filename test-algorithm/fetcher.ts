require("dotenv").config();

import { LocalStorage } from "node-localstorage";

const localstorage = new LocalStorage("./localstorage");

export const fetchDate = () => {
	if (process.env.ENV?.toUpperCase().includes("BACKTEST")) {
		const timestamp = localstorage.getItem("timestamp");
		if (timestamp === null) {
			throw new Error("Timestamp not set in ./localstorage");
		}
		return new Date(timestamp);
	}
};

export const fetchCandles = async (candles: number) => {
	if (process.env.ENV?.toUpperCase().includes("BACKTEST")) {
		const candles = localstorage.getItem("candles");
		if (candles === null) {
			throw new Error("Candles not set in ./localstorage");
		}
		return JSON.parse(candles);
	}
};

export const fetchPrice = async () => {
	if (process.env.ENV?.toUpperCase().includes("BACKTEST")) {
		const price = localstorage.getItem("price");
		if (price === null) {
			throw new Error("Price not set in ./localstorage");
		}
		return parseFloat(price);
	}
};
