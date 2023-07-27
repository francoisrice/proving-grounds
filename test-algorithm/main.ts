require("dotenv").config();
import {
	aggregateTrades,
	fetchCurrentAlgo,
	updateAlgoSettingsACID,
	updateCurrentAlgo,
	sendSellInterrupt,
} from "./mongo";

const tradingBots = process.env.TRADING_BOTS?.split(",") || [];
console.log(`Using algorithms: `);
console.log(tradingBots); // Display connected algo's & notify that we're alive

var profits: any[] = [];

const findMaxProfit = (profits: any[]) => {
	let maxProfit = profits[0];
	for (const profit of profits) {
		if (profit.grossProfitPercent > maxProfit.grossProfitPercent) {
			maxProfit = profit;
		}
	}
	return maxProfit;
};

// TODO: 1) Calculate unrealized profit for each algo & add to aggregated profits
// TODO: 2) If all profits are negative, then we should sell all assets and wait for a positive profit
export const main = async () => {
	var currentTime: Date = new Date();
	for (const algo of tradingBots) {
		const profit = await aggregateTrades(algo);

		// Check that a trade has been completed for this algo
		if (profit[0]) {
			profits.push(profit[0]);
		}
	}

	if (profits.length == 0) {
		console.log(`No available algos have completed a trade. Exiting...`);
		return;
	}

	const maxProfit = findMaxProfit(profits);

	const currentAlgo = await fetchCurrentAlgo();

	if (currentAlgo) {
		if (maxProfit._id == currentAlgo?.currentAlgo) {
			console.log(
				`${currentTime} ${maxProfit._id} is still generating the most profit. No changes needed. Exiting...`
			);
			return;
		} else {
			console.log(
				`${currentTime} ${maxProfit._id} is now creating more profit than ${currentAlgo?.currentAlgo}. Shifting funds...`
			);

			const updateAlgosResponse = await updateAlgoSettingsACID(
				currentAlgo?.currentAlgo,
				maxProfit._id
			);

			if (updateAlgosResponse?.acknowledged) {
				const sellResult: boolean = await sendSellInterrupt();
				if (sellResult) {
					const updateChimeraResponse = await updateCurrentAlgo(maxProfit._id);
					if (updateChimeraResponse.acknowledged) {
						console.log(
							`${currentTime} Successfully initiated fund transfer to ${maxProfit._id}!`
						);
					}
				}
			}
		}
	} else {
		console.log(
			`${currentTime} Bitcoin Chimera was not able to access settings from database. Exiting...`
		);
		return;
	}

	// Start trading bot with max profit
};

setInterval(async () => {
	await main();
}, 1000 * 60 * 60 * 24 * 3); // Run every 3 days
