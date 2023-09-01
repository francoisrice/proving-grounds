require("dotenv").config();
import { readFileSync, writeFileSync } from "fs";
import { LocalStorage } from "node-localstorage";
import { MongoClient } from "mongodb";

import { TradeInfo } from "./types";

if (process.env.ENV?.toUpperCase().includes("BACKTEST")) {
	//
} else {
	var uri = process.env.MONGO_URI || "";
	// console.log(uri);
	var client = new MongoClient(uri);
}

const algo = process.env.ALGO;

const localstorage = new LocalStorage(`./test-algorithm/${algo}-localstorage`);

export const getDatetime3daysAgo = (date: Date) => {
	date.setDate(date.getDate() - 3);
	return date;
};

export const aggregateTrades = async (algo: string) => {
	if (process.env.ENV?.toUpperCase().includes("BACKTEST")) {
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
		const currentDate = parseInt(timestamp);

		const trades: TradeInfo[] = JSON.parse(
			readFileSync(`../results/${algo}-trades.json`, "utf-8")
		);

		var subTrades: TradeInfo[] = [];

		trades.forEach((trade) => {
			if (
				trade.entryDatetime.getTime() / 1000 > threeDaysAgo &&
				trade.exitDatetime.getTime() / 1000 < currentDate
			) {
				subTrades.push(trade);
			}
		});

		// Get trades from the last 3 days
		// 	Must store trades ... in a time-series list ...
		// 		where I can easily get a subset by date

		// List of objects; timestamp field; all values more than X
		// 		and less than Y go into the subset; no-dedup required

		return subTrades;
	} else {
		const currentDate = new Date();

		const trades = await client
			// .db("trades")
			// .collection(algo)
			.db("dev")
			.collection("trades")
			.aggregate([
				{
					$match: {
						algo: algo,
						exitDatetime: { $gt: getDatetime3daysAgo(currentDate) },
					},
				},
				{
					$group: {
						_id: "$algo",
						grossProfitPercent: { $sum: "$profitPercent" },
					},
				},
			])
			.toArray();

		return trades;
	}
};

export const fetchCurrentAlgo = async () => {
	if (process.env.ENV?.toUpperCase().includes("BACKTEST")) {
		var currentAlgo = null;
		while (!currentAlgo) {
			currentAlgo = localstorage.getItem("chimera-currentAlgo");
		}
		return currentAlgo;
	} else {
		let chimera: string = "bitcoin-chimera";

		const algo = await client
			.db("dev")
			.collection("chimera")
			.findOne({ chimera });

		// console.log(algo);
		return algo?.currentAlgo;
	}
};

export const updateAlgoSettingsACID = async (
	previousAlgo: string,
	newAlgo: string
) => {
	if (process.env.ENV?.toUpperCase().includes("BACKTEST")) {
		localstorage.setItem(`${previousAlgo}-buy`, "100");
		localstorage.setItem(`${previousAlgo}-sell`, "100");
		localstorage.setItem(`${newAlgo}-buy`, "10000");
		localstorage.setItem(`${newAlgo}-sell`, "10000");
	} else {
		const session = client.startSession();

		const transactionResults = await session.withTransaction(
			async () => {
				const previousAlgoUpdateResponse = await client
					.db("dev")
					.collection("params")
					.updateOne(
						{ algo: previousAlgo },
						{ $set: { buySize: 10, sellSize: 10 } },
						{ session }
					);
				const newAlgoUpdateResponse = await client
					.db("dev")
					.collection("params")
					.updateOne(
						{ algo: newAlgo },
						{ $set: { buySize: "MAX", sellSize: "MAX" } },
						{ session }
					);
				// TODO: ROllback logic
				// TODO: Retry logic
			},
			{
				readPreference: "primary",
				readConcern: { level: "local" },
				writeConcern: { w: "majority" },
			}
		);

		return transactionResults;
	}
};

export const updateCurrentAlgo = async (newAlgo: string) => {
	if (process.env.ENV?.toUpperCase().includes("BACKTEST")) {
		localstorage.setItem("chimera-currentAlgo", `${newAlgo}`);
		return { acknowledged: true };
	} else {
		const updateResponse = await client
			.db("dev")
			.collection("chimera")
			.updateOne(
				{ chimera: "bitcoin-chimera" },
				{ $set: { currentAlgo: newAlgo } }
			);

		return updateResponse;
	}
};

export const sendSellInterrupt = async (
	previousAlgo: string,
	newAlgo: string
) => {
	if (process.env.ENV?.toUpperCase().includes("BACKTEST")) {
		localstorage.setItem(
			"sellInterrupt-algo",
			`'{"sellInterrupt": true, "algo": "${algo}"}'`
		);

		localstorage.setItem("chimera-currentAlgo", `${newAlgo}`);

		return true;
	} else {
		const updateResponse = await client
			.db("dev")
			.collection("chimera")
			.updateOne(
				{ chimera: "bitcoin-chimera" },
				{ $set: { sellInterrupt: true, previousAlgo, currentAlgo: newAlgo } }
			);

		return updateResponse.acknowledged;
	}
};

export const fetchAlgoParams = async (algo: string) => {
	const accountSize: any = process.env.ACCOUNT_SIZE || "10000";
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
	if (process.env.ENV?.toUpperCase().includes("BACKTEST")) {
		const timestamp = localstorage.getItem("timestamp");
		var entries = JSON.parse(
			readFileSync(`results/${algo}-entries.json`, "utf-8")
		);
		entries.push({ timestamp, algo, entryPrice });
		writeFileSync(`results/${algo}-entries.json`, JSON.stringify(entries));
		return { acknowledged: true };
	} else {
		const datetime = new Date();

		await client.connect();

		const entry = await client
			.db("dev")
			.collection("entries")
			.insertOne({ datetime, algo, entryPrice });

		await client.close();

		return entry;
	}
};

export const sendExitInfoToDB = async (algo: string, exitPrice: number) => {
	if (process.env.ENV?.toUpperCase().includes("BACKTEST")) {
		const timestamp = localstorage.getItem("timestamp");
		var exits = JSON.parse(readFileSync(`results/${algo}-exits.json`, "utf-8"));
		exits.push({ timestamp, algo, exitPrice });
		writeFileSync(`results/${algo}-exits.json`, JSON.stringify(exits));
		return { acknowledged: true };
	} else {
		const datetime = new Date();

		await client.connect();

		const exit = await client
			.db("dev")
			.collection("exits")
			.insertOne({ datetime, algo, exitPrice });

		await client.close();

		return exit;
	}
};

export const sendTradeInfoToDB = async (algo: string, tradeInfo: TradeInfo) => {
	if (process.env.ENV?.toUpperCase().includes("BACKTEST")) {
		const tradesObj = readFileSync(`results/${algo}-trades.json`, "utf-8");
		var trades: TradeInfo[] = JSON.parse(tradesObj);
		trades.push(tradeInfo);
		writeFileSync(`results/${algo}-trades.json`, JSON.stringify(trades));
		return { acknowledged: true };
	} else {
		await client.connect();

		const trade = await client
			.db("dev")
			.collection("trades")
			.insertOne({ ...tradeInfo });

		await client.close();

		return trade;
	}
};
