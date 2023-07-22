require("dotenv").config();

import { LocalStorage } from "node-localstorage";

const localstorage = new LocalStorage("./localstorage");

export interface TradeInfo {
	exitDatetime: Date;
	entryDatetime: Date;
	mode: string;
	entryPrice: number | string;
	entryAmountUSD: number | string;
	exitPrice: number;
	algo: string;
	profitAbsolute: number | string;
	profitPercent: number | string;
}

const getDatetime3daysAgo = (date: Date) => {
	date.setDate(date.getDate() - 3);
	return date;
};

export const aggregateTrades = async (algo: string) => {
	var timestamp: any = null;
	var count: number = 0;
	while (!timestamp) {
		timestamp = localstorage.getItem("timestamp");
		count++;
		if (count > 5) {
			console.log(
				"Stuck fetching current Timestamp in aggregateTrades() - mongo.ts"
			);
		}
	}
	const threeDaysAgo = parseInt(timestamp) - 72 * 60 * 60;
	// currentDate = parseInt(timestamp);

	// pull trades

	var subTrades: TradeInfo[] = [];

	/* 	trades.map((trade: TradeInfo) => {
		if (
			trade.entryDatetime.getTime() / 1000 > threeDaysAgo &&
			trade.exitDatetime.getTime() / 1000 < parseInt(timestamp)
		) {
			subTrades.append(trade);
		}
	}); */

	// Get trades from the last 3 days
	// 	Must store trades ... in a time-series list ...
	// 		where I can easily get a subset by date

	// List of objects; timestamp field; all values more than X
	// 		and less than Y go into the subset; no-dedup required

	// return trades;
};

export const fetchCurrentAlgo = async () => {
	var currentAlgo = null;
	while (!currentAlgo) {
		currentAlgo = localstorage.getItem("chimera-currentAlgo");
	}
	return currentAlgo;
};

export const updateAlgoSettingsACID = async (
	previousAlgo: string,
	newAlgo: string
) => {
	localstorage.setItem(`${previousAlgo}-buy`, "100");
	localstorage.setItem(`${previousAlgo}-sell`, "100");
	localstorage.setItem(`${newAlgo}-buy`, "10000");
	localstorage.setItem(`${newAlgo}-sell`, "10000");
};

export const updateCurrentAlgo = async (newAlgo: string) => {
	localstorage.setItem("chimera-currentAlgo", `${newAlgo}`);
};

export const sendSellInterrupt = async (algo: string) => {
	localstorage.setItem(
		"sellInterrupt-algo",
		`'{"sellInterrupt": true, "algo": "${algo}"}'`
	);
};

export const fetchAlgoParams = async (algo: string) => {
	const accountSize: number = parseInt(process.env.ACCOUNT_SIZE || "10000");
	return { buyVar: accountSize, sellVar: accountSize };
};

export const newSellInterrupt = async (algo: string): Promise<boolean> => {
	const sellInterrupt = localstorage.getItem("sellInterrupt-algo");
	const interruptObject = JSON.parse(sellInterrupt || "{}");
	if (interruptObject.sellInterrupt && interruptObject.algo === algo) {
		return true;
	}

	return false;
};

export const sendEntryInfoToDB = async (algo: string, entryPrice: number) => {
	// datetime?
	localstorage.setItem("entry", entryPrice.toString());
};

export const sendExitInfoToDB = async (algo: string, exitPrice: number) => {
	// datetime?
	localstorage.setItem("exit", exitPrice.toString());
};

export const sendTradeInfoToDB = async (tradeInfo: TradeInfo) => {
	// datetime?
	localstorage.setItem("trade", JSON.stringify(tradeInfo));
};
