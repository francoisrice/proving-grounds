import { LocalStorage } from "node-localstorage";
import {
	fetchAlgoParams,
	newSellInterrupt,
	sendEntryInfoToDB,
	sendExitInfoToDB,
	sendTradeInfoToDB,
} from "./mongo";
import { TradeInfo } from "./types";

const localstorage: LocalStorage = new LocalStorage("./localstorage");

const api_key: string = process.env.COINBASE_API_KEY || "";
const api_secret: string = process.env.COINBASE_API_SECRET || "";

const isLiveTrading: boolean =
	(process.env.LIVE_TRADING || "false").toUpperCase().includes("T") ||
	(process.env.LIVE_TRADING || "false").toUpperCase().includes("Y");

const algo: string = process.env.ALGO || "new-monthly-high-1mon-btc-v0_1";

var isPositionOpen = false;
var currentMonth: number = 0;
var monthlyHigh: number = 0;
var monthlyLow: number = 0;

const isNewMonth = (): boolean => {
	var time: Date = new Date();
	if (time.getMonth() != currentMonth) {
		currentMonth = time.getMonth();
		return true;
	}
	return false;
};

const fetchPrice = async (): Promise<number> => {
	const response = await fetch(
		"https://api.coindesk.com/v1/bpi/currentprice.json",
		{ method: "GET" }
	);
	const responseData = await response.json();

	return responseData.bpi.USD.rate_float;
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

const calcBaseSize = (price: number, sellVar: string): number => {
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
		base_size = assetAmount * (price / entryPrice);
	} else {
		base_size = parseFloat(sellVar) / price;
	}

	return base_size;
};

const main = async () => {
	const { buyVar, sellVar } = await fetchAlgoParams(algo);
	var currentTime: Date = new Date();
	if (await newSellInterrupt(algo)) {
		// Sell all positions
		console.log(
			`${currentTime} New Sell Interrupt detected. Selling all positions.`
		);

		const price: number = await fetchPrice();
		var base_size: number = calcBaseSize(price, sellVar);

		// Put logic for live trade here

		const orderResponse = await sendMockSellOrder(base_size);
		const order = await orderResponse;

		if (order.data.success === true) {
			isPositionOpen = false;
			const assetAmount = 100.0 / price;

			console.log(
				`${currentTime} Sell Order successful. Sold ${assetAmount.toString()} BTC @ ${price.toString()}`
			);

			const exitResponse = await sendExitInfoToDB(algo, price);
			if (exitResponse?.acknowledged) {
				console.log(`${currentTime} Exit logged in Database.`);
			} else {
				console.log("Failed to send Exit to Database.");
			}

			const tradeInfo: TradeInfo = createTrade(currentTime, price);
			const response = await sendTradeInfoToDB(algo, tradeInfo);
			if (response?.acknowledged) {
				console.log(`${currentTime} Trade logged in Database.`);
			}
		}
	} else {
		const price: number = await fetchPrice();
		console.log(price); // Let us know you're alive

		if (isNewMonth() || monthlyHigh == 0 || monthlyLow == 0) {
			monthlyHigh = price;
			monthlyLow = price;
		}
		if (price > monthlyHigh) {
			monthlyHigh = price;
			if (!isPositionOpen) {
				// Open a position
				console.log(
					`${currentTime} New Monthly High detected. Buying a position @ ${price.toString()}`
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
					const assetAmount = 100.0 / price;

					console.log(
						`${currentTime} Buy Order successful. Bought ${assetAmount.toString()} BTC @ ${price.toString()}`
					);

					const entryResponse = await sendEntryInfoToDB(algo, price);
					if (entryResponse?.acknowledged) {
						console.log(`${currentTime} Entry logged in Database.`);
					} else {
						console.log(`Failed to send Entry to Database.`);
					}

					localstorage.setItem(`assetAmount-BTC`, assetAmount.toString());
					localstorage.setItem(`entryPrice-BTC`, price.toString());
				}
			}
		}
		if (price < monthlyLow) {
			monthlyLow = price;
			if (isPositionOpen) {
				// Close a position
				console.log(
					`${currentTime} New Monthly Low detected. Selling a position @ ${price.toString()}`
				);

				var base_size: number = calcBaseSize(price, sellVar);

				// if (isLiveTrading) {
				// const orderResponse = await sendSellOrder();
				// const order = await orderResponse.json();
				// } else {
				const orderResponse = await sendMockSellOrder(base_size);
				const order = await orderResponse;
				// }

				if (order.data.success === true) {
					isPositionOpen = false;
					const assetAmount = 100.0 / price;

					console.log(
						`${currentTime} Sell Order successful. Sold ${assetAmount.toString()} BTC @ ${price.toString()}`
					);

					const exitResponse = await sendExitInfoToDB(algo, price);
					if (exitResponse?.acknowledged) {
						console.log(`${currentTime} Exit logged in Database.`);
					} else {
						console.log("Failed to send Exit to Database.");
					}

					const tradeInfo: TradeInfo = createTrade(currentTime, price);
					const response = await sendTradeInfoToDB(tradeInfo);
					if (response?.acknowledged) {
						console.log(`${currentTime} Trade logged in Database.`);
					}
				}
			}
		}
	}
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

console.log(`Starting ${algo} ...`);
setInterval(async () => {
	await main();
}, 60000);
